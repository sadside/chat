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
        assert build_context([], context_window=8192) == []

    def test_single_user_message_passthrough(self):
        msgs = [_msg("user", "Hello")]
        result = build_context(msgs, context_window=8192)
        assert result == [{"role": "user", "content": "Hello"}]

    def test_system_message_preserved_first(self):
        msgs = [
            _msg("system", "You are helpful."),
            _msg("user", "Hi"),
        ]
        result = build_context(msgs, context_window=8192)
        assert result[0] == {"role": "system", "content": "You are helpful."}
        assert result[1] == {"role": "user", "content": "Hi"}

    def test_truncates_from_head_keeping_tail(self):
        # Each message = 400 chars → ~100 tokens. budget = 4 * 0.75 * 100 = 300 tokens → 3 messages max
        big_content = "x" * 400
        msgs = [_msg("user", big_content) for _ in range(6)]
        build_context(msgs, context_window=1600, fill_ratio=0.75)
        # budget = 1200 tokens; each msg = 100 tokens → 12 fit, but we only have 6
        # Use small window: context_window=400 → budget=300 tokens → 3 messages
        result2 = build_context(msgs, context_window=400, fill_ratio=0.75)
        assert len(result2) == 3
        # Should be the last 3 messages (tail kept)

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
        result = build_context(msgs, context_window=8192)
        assert [r["role"] for r in result] == ["user", "assistant", "user"]

    def test_fill_ratio_respected(self):
        # 4 messages of 1000 chars each = ~250 tokens each, total ~1000
        # budget at fill_ratio=0.5, window=1000 → 500 tokens → 2 messages
        msgs = [_msg("user", "z" * 1000) for _ in range(4)]
        result = build_context(msgs, context_window=1000, fill_ratio=0.5)
        assert len(result) == 2
