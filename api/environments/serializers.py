import typing

from rest_framework import serializers

from audit.models import (
    ENVIRONMENT_CREATED_MESSAGE,
    ENVIRONMENT_UPDATED_MESSAGE,
    AuditLog,
    RelatedObjectType,
)
from environments.models import Environment, EnvironmentAPIKey, Webhook
from features.serializers import FeatureStateSerializerFull
from metadata.serializers import MetadataSerializer, MetadataSerializerMixin
from organisations.models import Subscription
from organisations.subscriptions.serializers.mixins import (
    ReadOnlyIfNotValidPlanMixin,
)
from projects.models import Project
from projects.serializers import ProjectSerializer


class EnvironmentSerializerFull(serializers.ModelSerializer):
    feature_states = FeatureStateSerializerFull(many=True)
    project = ProjectSerializer()

    class Meta:
        model = Environment
        fields = (
            "id",
            "name",
            "feature_states",
            "project",
            "api_key",
            "minimum_change_request_approvals",
            "allow_client_traits",
        )


class EnvironmentSerializerLight(serializers.ModelSerializer, MetadataSerializerMixin):
    metadata = MetadataSerializer(required=False, many=True)

    class Meta:
        model = Environment
        fields = (
            "id",
            "name",
            "api_key",
            "description",
            "project",
            "minimum_change_request_approvals",
            "allow_client_traits",
            "banner_text",
            "banner_colour",
            "metadata",
        )

    def save(self, **kwargs):
        # maybe move this to a mixin
        self.check_required_metadata(self.validated_data.pop("metadata", []))

        metadata = self.initial_data.pop("metadata", None)
        metadata_serializer = MetadataSerializer(
            data=metadata, many=True, context=self.context
        )
        metadata_serializer.is_valid(raise_exception=True)

        instance = super().save(**kwargs)

        metadata_serializer.save(content_object=instance)
        return instance

    def create(self, validated_data):
        instance = super(EnvironmentSerializerLight, self).create(validated_data)
        self._create_audit_log(instance, True)
        return instance

    def update(self, instance, validated_data):
        updated_instance = super(EnvironmentSerializerLight, self).update(
            instance, validated_data
        )
        self._create_audit_log(instance, False)
        return updated_instance

    def _create_audit_log(self, instance, created):
        message = (
            ENVIRONMENT_CREATED_MESSAGE if created else ENVIRONMENT_UPDATED_MESSAGE
        ) % instance.name
        request = self.context.get("request")

        author = None if request.user.is_anonymous else request.user
        master_api_key = request.master_api_key if request.user.is_anonymous else None
        AuditLog.objects.create(
            author=author,
            related_object_id=instance.id,
            related_object_type=RelatedObjectType.ENVIRONMENT.name,
            environment=instance,
            project=instance.project,
            log=message,
            master_api_key=master_api_key,
        )


class CreateUpdateEnvironmentSerializer(
    ReadOnlyIfNotValidPlanMixin, EnvironmentSerializerLight
):
    invalid_plans = ("free",)
    field_names = ("minimum_change_request_approvals",)

    def get_subscription(self) -> typing.Optional[Subscription]:
        view = self.context["view"]

        if view.action == "create":
            # handle `project` not being part of the data
            # When request comes from yasg2(as part of schema generation)
            project_id = view.request.data.get("project")
            if not project_id:
                return None

            project = Project.objects.select_related(
                "organisation", "organisation__subscription"
            ).get(id=project_id)

            return getattr(project.organisation, "subscription", None)
        elif view.action in ("update", "partial_update"):
            return getattr(self.instance.project.organisation, "subscription", None)

        return None


class CloneEnvironmentSerializer(EnvironmentSerializerLight):
    class Meta:
        model = Environment
        fields = ("id", "name", "api_key", "project")
        read_only_fields = ("id", "api_key", "project")

    def create(self, validated_data):
        name = validated_data.get("name")
        source_env = validated_data.get("source_env")
        clone = source_env.clone(name)
        self._create_audit_log(clone, True)
        return clone


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ("id", "url", "enabled", "created_at", "updated_at", "secret")
        read_only_fields = ("id", "created_at", "updated_at")


class EnvironmentAPIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = EnvironmentAPIKey
        fields = ("id", "key", "active", "created_at", "name", "expires_at")
        read_only_fields = ("id", "created_at", "key")
