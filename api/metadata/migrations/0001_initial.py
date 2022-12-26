# Generated by Django 3.2.16 on 2022-12-25 11:38

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('organisations', '0037_add_default_subscription_to_existing_organisations'),
    ]

    operations = [
        migrations.CreateModel(
            name='MetadataField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('type', models.CharField(choices=[('int', 'Integer'), ('str', 'String'), ('bool', 'Boolean'), ('float', 'Float')], default='str', max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_required', models.BooleanField(default=False)),
                ('organisation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='organisations.organisation')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='Metadata',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('object_id', models.PositiveIntegerField()),
                ('field_data', models.TextField()),
                ('content_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype')),
                ('field', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='metadata.metadatafield')),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
