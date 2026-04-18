"""Unit tests for context_builder — no DB, no I/O."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.services.context_builder import build_context


def _msg(role: str, content: str) -> MagicMock:
    m = MagicMock()
    m.role = role
    m.content = content
    return m


class TestBuildContext:
    def test_empty_messages_returns_empty(self):
        # Default system prompt is injected into every call
        result = build_context([], context_window=8192)
        assert len(result) == 1
        assert result[0]["role"] == "system"

    def test_empty_messages_no_system_prompt(self):
        result = build_context([], context_window=8192, system_prompt=None)
        assert result == []

    def test_single_user_message_passthrough(self):
        msgs = [_msg("user", "Hello")]
        result = build_context(msgs, context_window=8192, system_prompt=None)
        assert result == [{"role": "user", "content": "Hello"}]

    def test_default_system_prompt_is_injected_when_no_system_msg(self):
        msgs = [_msg("user", "Hi")]
        result = build_context(msgs, context_window=8192)
        assert result[0]["role"] == "system"
        assert "русск" in result[0]["content"].lower()
        assert result[1] == {"role": "user", "content": "Hi"}

    def test_system_message_from_db_preserved_over_default(self):
        msgs = [
            _msg("system", "Custom instructions."),
            _msg("user", "Hi"),
        ]
        result = build_context(msgs, context_window=8192)
        assert result[0] == {"role": "system", "content": "Custom instructions."}
        assert result[1] == {"role": "user", "content": "Hi"}

    def test_truncates_from_head_keeping_tail(self):
        big_content = "x" * 400
        msgs = [_msg("user", big_content) for _ in range(6)]
        result2 = build_context(msgs, context_window=400, fill_ratio=0.75, system_prompt=None)
        assert len(result2) == 3

    def test_system_preserved_when_tail_truncated(self):
        big_content = "y" * 400
        msgs = [
            _msg("system", "sys"),
            *[_msg("user", big_content) for _ in range(10)],
        ]
        result = build_context(msgs, context_window=400, fill_ratio=0.75)
        assert result[0]["role"] == "system"

    def test_roles_preserved(self):
        msgs = [_msg("user", "q"), _msg("assistant", "a"), _msg("user", "q2")]
        result = build_context(msgs, context_window=8192, system_prompt=None)
        assert [r["role"] for r in result] == ["user", "assistant", "user"]

    def test_fill_ratio_respected(self):
        msgs = [_msg("user", "z" * 1000) for _ in range(4)]
        result = build_context(msgs, context_window=1000, fill_ratio=0.5, system_prompt=None)
        assert len(result) == 2
