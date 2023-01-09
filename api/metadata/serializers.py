from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from util.util import str_to_bool

from .models import (
    FIELD_VALUE_MAX_LENGTH,
    Metadata,
    MetadataField,
    MetadataModelField,
)


class MetadataFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetadataField
        fields = ("id", "name", "type", "description", "organisation")


class MetaDataModelFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetadataModelField
        fields = ("id", "field", "is_required", "content_type")


class ContentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentType
        fields = ("id", "app_label", "model")


class MetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = Metadata
        fields = ("id", "model_field", "field_value")

    def validate(self, data):
        data = super().validate(data)
        expected_type = data["model_field"].field.type
        try:
            casting_function = {
                "int": int,
                "float": float,
                "str": str,
                "bool": str_to_bool,
            }[expected_type]
            casting_function(data["field_value"])

        except ValueError:
            raise serializers.ValidationError(
                f"Invalid data type. Must be the string representation of {expected_type}"
            )

        if expected_type == str and len(data["field_value"]) > FIELD_VALUE_MAX_LENGTH:
            raise serializers.ValidationError(
                f"Value string is too long. Must be less than {FIELD_VALUE_MAX_LENGTH} character"
            )
        return data


class MetadataSerializerMixin:
    def validate_required_metadata(self, data):
        metadata = data.get("metadata", [])

        content_type = ContentType.objects.get_for_model(self.Meta.model)

        required_metadata_fields = MetadataModelField.objects.filter(
            content_type=content_type, is_required=True
        )

        for metadata_field in required_metadata_fields:
            if not any([field["model_field"] == metadata_field for field in metadata]):
                raise serializers.ValidationError(
                    {
                        "metadata": f"Missing required metadata field: {metadata_field.field.name}"
                    }
                )

    def validate(self, data):
        data = super().validate(data)
        self.validate_required_metadata(data)
        return data
