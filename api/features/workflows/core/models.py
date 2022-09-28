import logging
import typing

from core.helpers import get_current_site_url
from core.mail import safe_send_mail as send_mail
from core.models import AbstractBaseExportableModel
from django.conf import settings
from django.db import models
from django.template.loader import render_to_string
from django.utils import timezone
from django_lifecycle import (
    AFTER_CREATE,
    AFTER_SAVE,
    AFTER_UPDATE,
    LifecycleModel,
    LifecycleModelMixin,
    hook,
)

from audit.models import (
    CHANGE_REQUEST_APPROVED_MESSAGE,
    CHANGE_REQUEST_COMMITTED_MESSAGE,
    CHANGE_REQUEST_CREATED_MESSAGE,
    AuditLog,
    RelatedObjectType,
)
from environments.tasks import rebuild_environment_document
from features.models import FeatureState

from .exceptions import (
    CannotApproveOwnChangeRequest,
    ChangeRequestNotApprovedError,
)

if typing.TYPE_CHECKING:
    from users.models import FFAdminUser

logger = logging.getLogger(__name__)


class ChangeRequest(LifecycleModelMixin, AbstractBaseExportableModel):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="change_requests",
    )

    environment = models.ForeignKey(
        "environments.Environment",
        on_delete=models.CASCADE,
        related_name="change_requests",
    )

    deleted_at = models.DateTimeField(null=True)
    committed_at = models.DateTimeField(null=True)
    committed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="committed_change_requests",
        null=True,
    )

    def approve(self, user: "FFAdminUser"):
        if user.id == self.user_id:
            raise CannotApproveOwnChangeRequest(
                "User cannot approve their own Change Request."
            )

        ChangeRequestApproval.objects.update_or_create(
            change_request=self, user=user, defaults={"approved_at": timezone.now()}
        )

    def commit(self, committed_by: "FFAdminUser"):
        if not self.is_approved():
            raise ChangeRequestNotApprovedError(
                "Change request has not been approved by all required approvers."
            )

        logger.debug("Committing change request #%d", self.id)

        feature_states = list(self.feature_states.all())

        for feature_state in feature_states:
            if not feature_state.live_from:
                feature_state.live_from = timezone.now()

            feature_state.version = FeatureState.get_next_version_number(
                environment_id=feature_state.environment_id,
                feature_id=feature_state.feature_id,
                feature_segment_id=feature_state.feature_segment_id,
                identity_id=feature_state.identity_id,
            )

        FeatureState.objects.bulk_update(
            feature_states, fields=["live_from", "version"]
        )

        self.committed_at = timezone.now()
        self.committed_by = committed_by
        self.save()

    @hook(AFTER_CREATE)
    def create_cr_created_audit_log(self):
        message = CHANGE_REQUEST_CREATED_MESSAGE % self.title
        AuditLog.objects.create(
            author=self.user,
            project=self.environment.project,
            environment=self.environment,
            related_object_type=RelatedObjectType.CHANGE_REQUEST.name,
            related_object_id=self.id,
            log=message,
        )

    @hook(AFTER_SAVE, when="committed_at", was=None, is_not=None)
    def create_cr_committed_audit_log(self):
        message = CHANGE_REQUEST_COMMITTED_MESSAGE % self.title
        AuditLog.objects.create(
            author=self.committed_by,
            project=self.environment.project,
            environment=self.environment,
            related_object_type=RelatedObjectType.CHANGE_REQUEST.name,
            related_object_id=self.id,
            log=message,
        )

    def is_approved(self):
        return self.environment.minimum_change_request_approvals is None or (
            self.approvals.filter(approved_at__isnull=False).count()
            >= self.environment.minimum_change_request_approvals
        )

    @property
    def is_committed(self):
        return self.committed_at is not None

    @property
    def url(self):
        if not self.id:
            raise AttributeError(
                "Change request must be saved before it has a url attribute."
            )
        url = get_current_site_url()
        url += f"/project/{self.environment.project.id}"
        url += f"/environment/{self.environment.api_key}"
        url += f"/change-requests/{self.id}"
        return url

    @property
    def email_subject(self):
        return f"Flagsmith Change Request: {self.title} (#{self.id})"

    @hook(AFTER_CREATE, when="committed_at", is_not=None)
    @hook(AFTER_SAVE, when="committed_at", was=None, is_not=None)
    def schedule_environment_rebuild(self):
        logger.debug("Scheduling environment rebuild for change request #%d", self.id)

        if not settings.EDGE_ENABLED:
            logger.debug("Edge is disabled. Not scheduling environment rebuild.")
            return

        now = timezone.now()
        feature_states = list(
            self.feature_states.filter(live_from__gt=now).order_by("live_from")
        )

        logger.debug("Number of associated feature states: %d", len(feature_states))

        previous_live_from = None
        for feature_state in feature_states:
            # currently we only support a single feature state and single schedule date
            # however this will ensure that if, in the future, we allow multiple feature
            # states per change request (and perhaps multiple schedule dates) then this
            # functionality will work as expected.
            if not previous_live_from or feature_state.live_from != previous_live_from:
                logger.debug(
                    "Scheduling rebuild of environment %d at %s",
                    self.environment_id,
                    feature_state.live_from.isoformat(),
                )
                rebuild_environment_document.delay(
                    delay_until=feature_state.live_from,
                    kwargs={"environment_id": self.environment_id},
                )
            previous_live_from = feature_state.live_from


class ChangeRequestApproval(LifecycleModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    change_request = models.ForeignKey(
        ChangeRequest, on_delete=models.CASCADE, related_name="approvals"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True)

    class Meta:
        unique_together = ("user", "change_request")

    @hook(AFTER_CREATE, when="approved_at", is_now=None)
    def send_email_notification_to_assignee(self):
        context = {
            "url": self.change_request.url,
            "approver": self.user,
            "author": self.change_request.user,
        }

        send_mail(
            subject=self.change_request.email_subject,
            message=render_to_string(
                "workflows_core/change_request_assignee_notification.txt", context
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.user.email],
            html_message=render_to_string(
                "workflows_core/change_request_assignee_notification.html", context
            ),
        )

    @hook(AFTER_CREATE, when="approved_at", is_not=None)
    @hook(AFTER_UPDATE, when="approved_at", was=None, is_not=None)
    def send_email_notification_to_author(self):
        context = {
            "url": self.change_request.url,
            "approver": self.user,
            "author": self.change_request.user,
        }

        send_mail(
            subject=self.change_request.email_subject,
            message=render_to_string(
                "workflows_core/change_request_approved_author_notification.txt",
                context,
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.change_request.user.email],
            html_message=render_to_string(
                "workflows_core/change_request_approved_author_notification.html",
                context,
            ),
        )

    @hook(AFTER_CREATE, when="approved_at", is_not=None)
    @hook(AFTER_UPDATE, when="approved_at", was=None, is_not=None)
    def create_cr_approved_audit_logs(self):
        message = CHANGE_REQUEST_APPROVED_MESSAGE % self.change_request.title
        AuditLog.objects.create(
            author=self.user,
            project=self.change_request.environment.project,
            environment=self.change_request.environment,
            related_object_type=RelatedObjectType.CHANGE_REQUEST.name,
            related_object_id=self.id,
            log=message,
        )
