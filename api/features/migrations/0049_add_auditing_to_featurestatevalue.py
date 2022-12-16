# Generated by Django 3.2.16 on 2022-12-16 15:40

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api_keys', '0002_soft_delete_api_keys'),
        ('features', '0048_add_master_api_key_to_historical_records'),
    ]

    operations = [
        migrations.AddField(
            model_name='historicalfeaturestatevalue',
            name='master_api_key',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.DO_NOTHING, to='api_keys.masterapikey'),
        ),
    ]