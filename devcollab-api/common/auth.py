from dataclasses import dataclass

from .db import one
from .http import ApiError

_known = set()


@dataclass
class CurrentUser:
    id: str
    username: str
    email: str


def _claims(event):
    authorizer = (event.get("requestContext") or {}).get("authorizer") or {}
    claims = authorizer.get("claims") or (authorizer.get("jwt") or {}).get("claims")
    return claims or None


def _ensure_user(user):
    if user.id in _known:
        return
    row = one(
        """
        INSERT INTO users (id, username, email, display_name)
        VALUES (:id, :username, :email, :username)
        ON CONFLICT (id) DO UPDATE SET email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email)
        RETURNING id
        """,
        id=user.id,
        username=user.username,
        email=user.email,
    )
    if row:
        _known.add(user.id)


def authenticate(event):
    claims = _claims(event)
    if not claims or not claims.get("sub"):
        raise ApiError(401, "Authentification requise")
    username = claims.get("cognito:username") or claims.get("username") or claims["sub"]
    user = CurrentUser(id=claims["sub"], username=username, email=claims.get("email") or "")
    _ensure_user(user)
    return user
