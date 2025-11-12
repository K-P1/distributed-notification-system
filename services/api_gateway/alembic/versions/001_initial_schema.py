"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2025-11-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_status table
    op.create_table(
        'notification_status',
        sa.Column('notification_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notification_type', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('notification_id'),
        sa.CheckConstraint("notification_type IN ('email', 'push')", name='check_notification_type'),
        sa.CheckConstraint("status IN ('pending', 'processing', 'delivered', 'failed')", name='check_status')
    )
    
    # Create indexes for notification_status
    op.create_index('ix_notification_status_request_id', 'notification_status', ['request_id'])
    op.create_index('ix_notification_status_user_id', 'notification_status', ['user_id'])
    op.create_index('ix_notification_status_notification_type', 'notification_status', ['notification_type'])
    op.create_index('ix_notification_status_status', 'notification_status', ['status'])
    op.create_index('ix_notification_status_created_at', 'notification_status', ['created_at'])
    
    # Create notification_status_history table
    op.create_table(
        'notification_status_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('notification_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('previous_status', sa.String(length=20), nullable=True),
        sa.Column('new_status', sa.String(length=20), nullable=False),
        sa.Column('changed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('changed_by', sa.String(length=100), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('change_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notification_status_history
    op.create_index('ix_notification_status_history_notification_id', 'notification_status_history', ['notification_id'])
    op.create_index('ix_notification_status_history_changed_at', 'notification_status_history', ['changed_at'])


def downgrade() -> None:
    # Drop notification_status_history table
    op.drop_index('ix_notification_status_history_changed_at', table_name='notification_status_history')
    op.drop_index('ix_notification_status_history_notification_id', table_name='notification_status_history')
    op.drop_table('notification_status_history')
    
    # Drop notification_status table
    op.drop_index('ix_notification_status_created_at', table_name='notification_status')
    op.drop_index('ix_notification_status_status', table_name='notification_status')
    op.drop_index('ix_notification_status_notification_type', table_name='notification_status')
    op.drop_index('ix_notification_status_user_id', table_name='notification_status')
    op.drop_index('ix_notification_status_request_id', table_name='notification_status')
    op.drop_table('notification_status')
