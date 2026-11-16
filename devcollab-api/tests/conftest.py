import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "devcollab_test")
os.environ.setdefault("DB_USER", "admindevcollab")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_SSL", "disable")

from common import auth, db

FUNCTIONS = {
    "users": "utilisateurs",
    "projects": "projets",
    "pull-requests": "pull_requests",
    "reviews": "reviews",
    "activity": "activite",
}


def _load(name):
    path = ROOT / "functions" / name / "lambda_function.py"
    spec = importlib.util.spec_from_file_location(f"fn_{name}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


HANDLERS = {prefix: _load(name).lambda_handler for prefix, name in FUNCTIONS.items()}

USERS = {
    "alice": {"sub": "sub-alice", "cognito:username": "alice", "email": "alice@test.dev"},
    "bob": {"sub": "sub-bob", "cognito:username": "bob", "email": "bob@test.dev"},
    "carol": {"sub": "sub-carol", "cognito:username": "carol", "email": "carol@test.dev"},
}


class Result:
    def __init__(self, raw):
        self.status = raw["statusCode"]
        self.headers = raw["headers"]
        self.json = json.loads(raw["body"]) if raw["body"] else None

    def __repr__(self):
        return f"<{self.status} {self.json}>"


def call(method, path, user="alice", body=None, query=None):
    prefix = path.strip("/").split("/")[0]
    event = {
        "httpMethod": method,
        "path": path,
        "queryStringParameters": query,
        "body": json.dumps(body) if body is not None else None,
        "requestContext": {"stage": "prod", "authorizer": {"claims": USERS[user]} if user else {}},
    }
    return Result(HANDLERS[prefix](event, None))


@pytest.fixture(autouse=True)
def fresh_db():
    db.execute("DROP SCHEMA public CASCADE")
    db.execute("CREATE SCHEMA public")
    db.get_conn().run((ROOT / "sql" / "schema.sql").read_text())
    auth._known.clear()
    yield


@pytest.fixture
def api():
    return call
