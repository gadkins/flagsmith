from rest_framework.permissions import IsAuthenticated

from metadata.models import MetadataField


class MetadataFieldPermissions(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        organisation = request.data.get("organisation")
        if view.action == "create" and request.user.belongs_to(organisation):
            return request.user.is_organisation_admin(organisation)

        # list is handled by the view
        if view.action == "list":
            return True

        # move on to object specific permissions
        return view.detail

    def has_object_permission(self, request, view, obj):
        if view.action in ("update", "destroy") and request.user.is_organisation_admin(
            obj.organisation
        ):
            return True

        return False


class MetadataModelFieldPermissions(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        organisation_pk = int(view.kwargs.get("organisation_pk"))

        if request.user.belongs_to(organisation_pk):
            if view.action == "list" or view.detail:
                return True

            if view.action == "create":
                field = MetadataField.objects.get(id=request.data.get("field"))

                return (
                    request.user.is_organisation_admin(organisation_pk)
                    and organisation_pk == field.organisation.id
                )

        return False

    def has_object_permission(self, request, view, obj):
        if view.action in ("update", "destroy") and request.user.is_organisation_admin(
            obj.field.organisation
        ):
            return True

        return False
