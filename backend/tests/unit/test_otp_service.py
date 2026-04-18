from __future__ import annotations

from app.services.otp_service import generate_code, hash_code, verify_code


def test_generate_code_has_expected_length():
    for length in (4, 6, 8):
        code = generate_code(length=length)
        assert len(code) == length
        assert code.isdigit()


def test_generate_code_randomness_smoke():
    codes = {generate_code() for _ in range(50)}
    assert len(codes) > 40  # крайне маловероятно совпадение


def test_hash_and_verify_round_trip():
    code = "123456"
    pepper = "dev-pepper"
    h = hash_code(code, pepper=pepper)
    assert verify_code(code, h, pepper=pepper) is True


def test_verify_rejects_wrong_code():
    h = hash_code("123456", pepper="p")
    assert verify_code("000000", h, pepper="p") is False


def test_verify_rejects_wrong_pepper():
    h = hash_code("123456", pepper="p1")
    assert verify_code("123456", h, pepper="p2") is False


def test_hash_is_hex_fixed_length():
    h = hash_code("123456", pepper="x")
    assert len(h) == 64
    int(h, 16)  # valid hex
