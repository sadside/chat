from __future__ import annotations

import hashlib
import hmac
import secrets


def generate_code(length: int = 6) -> str:
    """Cryptographically-secure numeric OTP of the given length."""
    if length < 4 or length > 10:
        raise ValueError("OTP length must be between 4 and 10")
    upper = 10**length
    value = secrets.randbelow(upper)
    return str(value).zfill(length)


def hash_code(code: str, *, pepper: str) -> str:
    """sha256(code + pepper) → hex digest."""
    return hashlib.sha256(f"{code}{pepper}".encode()).hexdigest()


def verify_code(code: str, expected_hash: str, *, pepper: str) -> bool:
    return hmac.compare_digest(hash_code(code, pepper=pepper), expected_hash)
