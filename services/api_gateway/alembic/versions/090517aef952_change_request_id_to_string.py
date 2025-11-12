"""change_request_id_to_string

Revision ID: 090517aef952
Revises: 001
Create Date: 2025-11-12 14:53:34.859529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '090517aef952'
down_revision: Union[str, Sequence[str], None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Change request_id column from UUID to String
    op.alter_column(
        'notification_status',
        'request_id',
        type_=sa.String(100),
        postgresql_using='request_id::text'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Change request_id column back from String to UUID
    op.alter_column(
        'notification_status',
        'request_id',
        type_=sa.dialects.postgresql.UUID(as_uuid=True),
        postgresql_using='request_id::uuid'
    )
