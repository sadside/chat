from app.services.model_catalog import metadata_for


def test_known_model_returns_catalog_entry():
    md = metadata_for("qwen2.5:7b")
    assert md["context_window"] == 32_768
    assert "russian" in md["capabilities"]


def test_unknown_model_returns_default():
    md = metadata_for("phantom:99b")
    assert md["context_window"] == 8192
    assert md["capabilities"] == []


def test_deepseek_r1_has_reasoning_capability():
    md = metadata_for("deepseek-r1:7b")
    assert "reasoning" in md["capabilities"]
