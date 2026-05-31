from app.services.llm_client import _strip_cjk


def test_strip_cjk_leaves_ascii_alone():
    assert _strip_cjk("hello world") == "hello world"


def test_strip_cjk_removes_chinese():
    out = _strip_cjk("hi 你好 there")
    assert "你" not in out
    assert "hi" in out and "there" in out


def test_strip_cjk_preserves_latex_commands():
    src = r"f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} a_n \cos(\frac{n\pi x}{L})"
    out = _strip_cjk(src)
    assert r"\frac{a_0}{2}" in out
    assert r"\sum_{n=1}^{\infty}" in out
    assert r"\cos" in out


def test_strip_cjk_preserves_latex_with_surrounding_cjk():
    # Model accidentally interleaves full-width characters with LaTeX.
    src = r"前 \frac{1}{2} 後"
    out = _strip_cjk(src)
    assert r"\frac{1}{2}" in out
