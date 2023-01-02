import pytest
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api_keys.models import MasterAPIKey
from environments.identities.models import Identity
from environments.identities.traits.models import Trait
from environments.models import Environment, EnvironmentAPIKey
from environments.permissions.constants import (
    MANAGE_IDENTITIES,
    VIEW_ENVIRONMENT,
    VIEW_IDENTITIES,
)
from environments.permissions.models import UserEnvironmentPermission
from features.feature_types import MULTIVARIATE
from features.models import Feature, FeatureSegment, FeatureState
from features.multivariate.models import MultivariateFeatureOption
from features.value_types import STRING
from features.workflows.core.models import ChangeRequest
from metadata.models import Metadata, MetadataField, MetadataModelField
from organisations.models import Organisation, OrganisationRole, Subscription
from organisations.subscriptions.constants import CHARGEBEE, XERO
from permissions.models import PermissionModel
from projects.models import Project, UserProjectPermission
from projects.tags.models import Tag
from segments.models import EQUAL, Condition, Segment, SegmentRule
from users.models import FFAdminUser, UserPermissionGroup

trait_key = "key1"
trait_value = "value1"


@pytest.fixture()
def test_user(django_user_model):
    return django_user_model.objects.create(email="user@example.com")


@pytest.fixture()
def auth_token(test_user):
    return Token.objects.create(user=test_user)


@pytest.fixture()
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture()
def test_user_client(api_client, test_user):
    api_client.force_authenticate(test_user)
    return api_client


@pytest.fixture()
def organisation(db, admin_user):
    org = Organisation.objects.create(name="Test Org")
    admin_user.add_organisation(org, role=OrganisationRole.ADMIN)
    return org


@pytest.fixture()
def default_user_permission_group(organisation):
    return UserPermissionGroup.objects.create(
        organisation=organisation, name="Default user permission group", is_default=True
    )


@pytest.fixture()
def user_permission_group(organisation, admin_user):
    user_permission_group = UserPermissionGroup.objects.create(
        organisation=organisation, name="User permission group", is_default=False
    )
    user_permission_group.users.add(admin_user)
    return user_permission_group


@pytest.fixture()
def subscription(organisation):
    subscription = Subscription.objects.get(organisation=organisation)
    # refresh organisation to load subscription
    organisation.refresh_from_db()
    return subscription


@pytest.fixture()
def xero_subscription(organisation):
    subscription = Subscription.objects.get(organisation=organisation)
    subscription.payment_method = XERO
    subscription.subscription_id = "subscription-id"
    subscription.save()

    # refresh organisation to load subscription
    organisation.refresh_from_db()
    return subscription


@pytest.fixture()
def chargebee_subscription(organisation):
    subscription = Subscription.objects.get(organisation=organisation)
    subscription.payment_method = CHARGEBEE
    subscription.subscription_id = "subscription-id"
    subscription.save()

    # refresh organisation to load subscription
    organisation.refresh_from_db()
    return subscription


@pytest.fixture()
def project(organisation):
    return Project.objects.create(name="Test Project", organisation=organisation)


@pytest.fixture()
def tag(project):
    return Tag.objects.create(label="tag", project=project, color="#000000")


@pytest.fixture()
def segment(project):
    return Segment.objects.create(name="segment", project=project)


@pytest.fixture()
def environment(project):
    return Environment.objects.create(name="Test Environment", project=project)


@pytest.fixture()
def identity(environment):
    return Identity.objects.create(identifier="test_identity", environment=environment)


@pytest.fixture()
def trait(identity):
    return Trait.objects.create(
        identity=identity, trait_key=trait_key, string_value=trait_value
    )


@pytest.fixture()
def multivariate_feature(project):
    feature = Feature.objects.create(
        name="feature", project=project, type=MULTIVARIATE, initial_value="control"
    )

    for percentage_allocation in (30, 30, 40):
        string_value = f"multivariate option for {percentage_allocation}% of users."
        MultivariateFeatureOption.objects.create(
            feature=feature,
            default_percentage_allocation=percentage_allocation,
            type=STRING,
            string_value=string_value,
        )

    return feature


@pytest.fixture()
def identity_matching_segment(project, trait):
    segment = Segment.objects.create(name="Matching segment", project=project)
    matching_rule = SegmentRule.objects.create(
        segment=segment, type=SegmentRule.ALL_RULE
    )
    Condition.objects.create(
        rule=matching_rule,
        property=trait.trait_key,
        operator=EQUAL,
        value=trait.trait_value,
    )
    return segment


@pytest.fixture()
def api_client():
    return APIClient()


@pytest.fixture()
def feature(project, environment):
    return Feature.objects.create(name="Test Feature1", project=project)


@pytest.fixture()
def change_request(environment, admin_user):
    return ChangeRequest.objects.create(
        environment=environment, title="Test CR", user_id=admin_user.id
    )


@pytest.fixture()
def feature_state(feature, environment):
    return FeatureState.objects.filter(environment=environment, feature=feature).first()


@pytest.fixture()
def change_request_feature_state(feature, environment, change_request, feature_state):
    feature_state.change_request = change_request
    feature_state.save()
    return feature_state


@pytest.fixture()
def feature_based_segment(project, feature):
    return Segment.objects.create(name="segment", project=project, feature=feature)


@pytest.fixture()
def user_password():
    return FFAdminUser.objects.make_random_password()


@pytest.fixture()
def reset_cache():
    # https://groups.google.com/g/django-developers/c/zlaPsP13dUY
    # TL;DR: Use this if your test interacts with cache since django
    # does not clear cache after every test
    cache.clear()
    yield
    cache.clear()


@pytest.fixture()
def feature_segment(feature, segment, environment):
    return FeatureSegment.objects.create(
        feature=feature, segment=segment, environment=environment
    )


@pytest.fixture()
def segment_featurestate(feature_segment, feature, environment):
    return FeatureState.objects.create(
        feature_segment=feature_segment, feature=feature, environment=environment
    )


@pytest.fixture()
def environment_api_key(environment):
    return EnvironmentAPIKey.objects.create(
        environment=environment, name="Test API Key"
    )


@pytest.fixture()
def master_api_key(organisation):
    _, key = MasterAPIKey.objects.create_key(name="test_key", organisation=organisation)
    return key


@pytest.fixture()
def master_api_key_client(master_api_key):
    # Can not use `api_client` fixture here because:
    # https://docs.pytest.org/en/6.2.x/fixture.html#fixtures-can-be-requested-more-than-once-per-test-return-values-are-cached
    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION="Api-Key " + master_api_key)
    return api_client


@pytest.fixture()
def view_environment_permission():
    return PermissionModel.objects.get(key=VIEW_ENVIRONMENT)


@pytest.fixture()
def manage_identities_permission():
    return PermissionModel.objects.get(key=MANAGE_IDENTITIES)


@pytest.fixture()
def view_identities_permission():
    return PermissionModel.objects.get(key=VIEW_IDENTITIES)


@pytest.fixture()
def view_project_permission():
    return PermissionModel.objects.get(key="VIEW_PROJECT")


@pytest.fixture()
def user_environment_permission(test_user, environment):
    return UserEnvironmentPermission.objects.create(
        user=test_user, environment=environment
    )


@pytest.fixture()
def user_project_permission(test_user, project):
    return UserProjectPermission.objects.create(user=test_user, project=project)


@pytest.fixture()
def metadata_field(organisation):
    return MetadataField.objects.create(
        name="test_field", type="int", organisation=organisation
    )


@pytest.fixture()
def environment_metadata_field(organisation, metadata_field, environment):
    environment_type = ContentType.objects.get_for_model(environment)
    return MetadataModelField.objects.create(
        organisation=organisation, field=metadata_field, content_type=environment_type
    )


@pytest.fixture()
def environment_metadata(environment, environment_metadata_field):
    environment_type = ContentType.objects.get_for_model(environment)
    return Metadata.objects.create(
        object_id=environment.id,
        content_type=environment_type,
        model_field=environment_metadata_field,
        field_data="some_data",
    )
