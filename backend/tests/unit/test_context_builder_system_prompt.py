from app.services.context_builder import build_context


def test_default_system_prompt_only_when_chat_has_none():
    ctx = build_context([], 8192, chat_system_prompt=None)
    assert ctx[0]["role"] == "system"
    assert len([c for c in ctx if c["role"] == "system"]) == 1


def test_chat_system_prompt_appended_as_second_system_message():
    ctx = build_context([], 8192, chat_system_prompt="Ты пират.")
    sys_msgs = [c for c in ctx if c["role"] == "system"]
    assert len(sys_msgs) == 2
    assert sys_msgs[0]["content"].startswith("Ты — Nova")
    assert sys_msgs[1]["content"] == "Ты пират."


def test_empty_chat_prompt_treated_as_unset():
    ctx = build_context([], 8192, chat_system_prompt="")
    sys_msgs = [c for c in ctx if c["role"] == "system"]
    assert len(sys_msgs) == 1
