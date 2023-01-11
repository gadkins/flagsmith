from django.contrib.contenttypes.models import ContentType
from django.utils.decorators import method_decorator
from drf_yasg2 import openapi
from drf_yasg2.utils import swagger_auto_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import MetadataField, MetadataModelField
from .permissions import (
    MetadataFieldPermissions,
    MetadataModelFieldPermissions,
)
from .serializers import (
    ContentTypeSerializer,
    MetadataFieldSerializer,
    MetaDataModelFieldSerializer,
)

METADATA_SUPPORTED_MODELS = ["environment"]


@method_decorator(
    name="list",
    decorator=swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(
                "organisation",
                openapi.IN_QUERY,
                "ID of the organisation to filter by.",
                required=True,
                type=openapi.TYPE_INTEGER,
            )
        ]
    ),
)
class MetadataFieldViewSet(viewsets.ModelViewSet):
    permission_classes = [MetadataFieldPermissions]
    serializer_class = MetadataFieldSerializer

    def get_queryset(self):
        queryset = MetadataField.objects.filter(
            organisation__in=self.request.user.organisations.all()
        )
        organisation_id = self.request.query_params.get("organisation")
        if not organisation_id:
            raise ValidationError("organisation parameter is required")

        queryset = queryset.filter(organisation__id=organisation_id)

        return queryset


@method_decorator(
    name="list",
    decorator=swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(
                "content_type",
                openapi.IN_QUERY,
                "Content type of the model to filter by.",
                required=False,
                type=openapi.TYPE_INTEGER,
            )
        ]
    ),
)
class MetaDataModelFieldViewSet(viewsets.ModelViewSet):
    permission_classes = [MetadataModelFieldPermissions]
    serializer_class = MetaDataModelFieldSerializer

    def get_queryset(self):
        queryset = MetadataModelField.objects.filter(
            field__organisation_id=self.kwargs.get("organisation_pk")
        )
        content_type = self.request.query_params.get("content_type")

        if content_type:
            queryset = queryset.filter(content_type__id=content_type)

        return queryset

    @swagger_auto_schema(
        method="GET", responses={200: ContentTypeSerializer(many=True)}
    )
    @action(
        detail=False,
        methods=["GET"],
        url_path="get-supported-content_types",
    )
    def get_supported_content_types(self, request, organisation_pk=None):
        qs = ContentType.objects.filter(model__in=METADATA_SUPPORTED_MODELS)
        serializer = ContentTypeSerializer(qs, many=True)

        return Response(serializer.data)
