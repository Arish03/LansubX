import re
from app.models.user import UserRole
from app.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_device_key,
    generate_device_secret,
)


def test_password_hashing():
    raw_password = "superSecretPassword123!"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("wrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    payload = {"sub": "42", "role": UserRole.ADMIN.value}
    token = create_access_token(payload)
    assert isinstance(token, str)

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["role"] == "admin"
    assert "exp" in decoded


def test_device_key_format():
    key = generate_device_key()
    assert key.startswith("dev_")
    # dev_ followed by 12 hex characters
    assert re.match(r"^dev_[0-9a-f]{12}$", key) is not None


def test_device_secret_format():
    secret = generate_device_secret()
    assert secret.startswith("sec_")
    assert len(secret) > 20
