"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-08 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='viewer'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. gateways
    op.create_table(
        'gateways',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_gateways_id'), 'gateways', ['id'], unique=False)
    op.create_index(op.f('ix_gateways_owner_id'), 'gateways', ['owner_id'], unique=False)

    # 3. devices
    op.create_table(
        'devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('gateway_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('device_key', sa.String(length=50), nullable=False),
        sa.Column('kind', sa.String(length=50), nullable=False),
        sa.Column('secret_hash', sa.String(length=255), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_online', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['gateway_id'], ['gateways.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_devices_id'), 'devices', ['id'], unique=False)
    op.create_index(op.f('ix_devices_owner_id'), 'devices', ['owner_id'], unique=False)
    op.create_index(op.f('ix_devices_gateway_id'), 'devices', ['gateway_id'], unique=False)
    op.create_index(op.f('ix_devices_device_key'), 'devices', ['device_key'], unique=True)

    # 4. device_templates
    op.create_table(
        'device_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_device_templates_id'), 'device_templates', ['id'], unique=False)
    op.create_index(op.f('ix_device_templates_kind'), 'device_templates', ['kind'], unique=True)

    # 5. telemetry
    op.create_table(
        'telemetry',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('metric', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_telemetry_id'), 'telemetry', ['id'], unique=False)
    op.create_index(op.f('ix_telemetry_device_id'), 'telemetry', ['device_id'], unique=False)
    op.create_index(op.f('ix_telemetry_metric'), 'telemetry', ['metric'], unique=False)
    op.create_index(op.f('ix_telemetry_ts'), 'telemetry', ['ts'], unique=False)
    op.create_index('ix_telemetry_device_metric_ts', 'telemetry', ['device_id', 'metric', 'ts'], unique=False)

    # 6. alarm_rules
    op.create_table(
        'alarm_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('metric', sa.String(length=100), nullable=False),
        sa.Column('operator', sa.String(length=10), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='warning'),
        sa.Column('debounce_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alarm_rules_id'), 'alarm_rules', ['id'], unique=False)
    op.create_index(op.f('ix_alarm_rules_device_id'), 'alarm_rules', ['device_id'], unique=False)

    # 7. alarms
    op.create_table(
        'alarms',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('state', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['rule_id'], ['alarm_rules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alarms_id'), 'alarms', ['id'], unique=False)
    op.create_index(op.f('ix_alarms_rule_id'), 'alarms', ['rule_id'], unique=False)
    op.create_index(op.f('ix_alarms_device_id'), 'alarms', ['device_id'], unique=False)

    # 8. commands
    op.create_table(
        'commands',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='sent'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_commands_id'), 'commands', ['id'], unique=False)
    op.create_index(op.f('ix_commands_device_id'), 'commands', ['device_id'], unique=False)


def downgrade() -> None:
    op.drop_table('commands')
    op.drop_table('alarms')
    op.drop_table('alarm_rules')
    op.drop_table('telemetry')
    op.drop_table('device_templates')
    op.drop_table('devices')
    op.drop_table('gateways')
    op.drop_table('users')
