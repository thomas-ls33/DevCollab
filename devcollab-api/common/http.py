import json
import os
import re
import traceback
import uuid
from datetime import date, datetime

from pg8000.exceptions import DatabaseError

from .db import pg_code


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class Request:
    def __init__(self, event, params, user):
        self.event = event
        self.method = event.get("httpMethod", "GET").upper()
        self.params = params
        self.query = event.get("queryStringParameters") or {}
        self.user = user
        self._body = None

    @property
    def body(self):
        if self._body is None:
            raw = self.event.get("body") or "{}"
            if self.event.get("isBase64Encoded"):
                import base64

                raw = base64.b64decode(raw).decode("utf-8")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                raise ApiError(400, "Corps de requête JSON invalide")
            if not isinstance(parsed, dict):
                raise ApiError(400, "Le corps de la requête doit être un objet JSON")
            self._body = parsed
        return self._body


def _default(value):
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    raise TypeError(f"Type non sérialisable : {type(value).__name__}")


def cors_headers():
    return {
        "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }


def response(status, body=None):
    headers = {**cors_headers(), "Content-Type": "application/json"}
    return {
        "statusCode": status,
        "headers": headers,
        "body": "" if body is None else json.dumps(body, default=_default, ensure_ascii=False),
    }


def error_response(status, message):
    return response(status, {"message": message})


_DB_ERRORS = {
    "23505": (409, "Cette ressource existe déjà"),
    "23503": (404, "Ressource liée introuvable"),
    "23514": (400, "Données invalides"),
    "22P02": (404, "Ressource introuvable"),
    "22001": (400, "Valeur trop longue"),
}


class Router:
    def __init__(self):
        self.routes = []

    def route(self, method, pattern):
        regex = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "/?$")

        def decorator(fn):
            self.routes.append((method.upper(), regex, fn))
            return fn

        return decorator

    def _path(self, event):
        path = event.get("path") or event.get("rawPath") or "/"
        stage = (event.get("requestContext") or {}).get("stage")
        if stage and path.startswith(f"/{stage}/"):
            path = path[len(stage) + 1:]
        return path

    def handle(self, event, auth):
        method = (event.get("httpMethod") or "GET").upper()
        if method == "OPTIONS":
            return response(204)
        path = self._path(event)
        try:
            allowed = False
            for route_method, regex, fn in self.routes:
                match = regex.match(path)
                if not match:
                    continue
                allowed = True
                if route_method != method:
                    continue
                user = auth(event)
                result = fn(Request(event, match.groupdict(), user))
                if isinstance(result, tuple):
                    return response(*result)
                return response(200, result)
            if allowed:
                return error_response(405, "Méthode non autorisée")
            return error_response(404, "Route introuvable")
        except ApiError as e:
            return error_response(e.status, e.message)
        except DatabaseError as e:
            code = pg_code(e)
            if code in _DB_ERRORS:
                return error_response(*_DB_ERRORS[code])
            traceback.print_exc()
            return error_response(500, "Erreur de base de données")
        except Exception:
            traceback.print_exc()
            return error_response(500, "Erreur interne du serveur")
