"""Small local JWT fallback used when python-jose is not installed."""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone


class JWTError(Exception):
    pass


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


class _JWT:
    def encode(self, payload: dict, key: str, algorithm: str = "HS256") -> str:
        if algorithm != "HS256":
            raise JWTError("Only HS256 is supported by the local fallback")
        normalized = {}
        for name, value in payload.items():
            normalized[name] = int(value.replace(tzinfo=timezone.utc).timestamp()) if isinstance(value, datetime) else value
        header = {"typ": "JWT", "alg": algorithm}
        signing_input = ".".join([
            _b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64encode(json.dumps(normalized, separators=(",", ":")).encode("utf-8")),
        ])
        signature = hmac.new(key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
        return f"{signing_input}.{_b64encode(signature)}"

    def decode(self, token: str, key: str, algorithms=None) -> dict:
        try:
            header_b64, payload_b64, signature_b64 = token.split(".")
            signing_input = f"{header_b64}.{payload_b64}"
            expected = hmac.new(key.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
            if not hmac.compare_digest(_b64encode(expected), signature_b64):
                raise JWTError("Invalid signature")
            payload = json.loads(_b64decode(payload_b64))
            if "exp" in payload and int(payload["exp"]) < int(datetime.now(timezone.utc).timestamp()):
                raise JWTError("Token expired")
            return payload
        except JWTError:
            raise
        except Exception as exc:
            raise JWTError(str(exc)) from exc


jwt = _JWT()
