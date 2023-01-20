from django.core import exceptions
from django.db import models


class GenericObjectID(models.PositiveIntegerField):
    def value_from_object(self, obj):
        # Return the value of the natural key
        return obj.content_object.natural_key()[0]

    def to_python(self, value):
        # override to_python to support deserialization using natural_key
        if value is None:
            return value
        if isinstance(value, str):
            return value
        try:
            return int(value)
        except (TypeError, ValueError):
            raise exceptions.ValidationError(
                self.error_messages["invalid"],
                code="invalid",
                params={"value": value},
            )
