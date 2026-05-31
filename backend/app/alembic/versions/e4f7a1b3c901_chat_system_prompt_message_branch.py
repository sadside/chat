"""chat_system_prompt_pinned + message_model_used_parent_branch

Revision ID: e4f7a1b3c901
Revises: d109aea730ae
Create Date: 2026-06-01 01:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f7a1b3c901"
down_revision: str | Sequence[str] | None = "d109aea730ae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chats",
        sa.Column("system_prompt", sa.String(length=4000), nullable=True),
    )
    op.add_column(
        "chats",
        sa.Column(
            "pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_chats_user_pinned_updated",
        "chats",
        ["user_id", "pinned", "updated_at"],
        unique=False,
    )

    op.add_column(
        "messages",
        sa.Column("model_used", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column(
            "parent_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "messages",
        sa.Column(
            "branch_index",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_foreign_key(
        "fk_messages_parent",
        "messages",
        "messages",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_messages_chat_parent_branch",
        "messages",
        ["chat_id", "parent_id", "branch_index"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_messages_chat_parent_branch", table_name="messages")
    op.drop_constraint("fk_messages_parent", "messages", type_="foreignkey")
    op.drop_column("messages", "branch_index")
    op.drop_column("messages", "parent_id")
    op.drop_column("messages", "model_used")
    op.drop_index("ix_chats_user_pinned_updated", table_name="chats")
    op.drop_column("chats", "pinned")
    op.drop_column("chats", "system_prompt")
