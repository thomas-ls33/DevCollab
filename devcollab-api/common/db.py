import os
import ssl
from contextlib import contextmanager

import pg8000.native
from pg8000.exceptions import DatabaseError, InterfaceError

_conn = None


def _ssl_context():
    mode = os.environ.get("DB_SSL", "require").lower()
    if mode == "disable":
        return None
    if mode == "verify":
        return ssl.create_default_context(cafile=os.environ.get("DB_SSL_CA") or None)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _connect():
    return pg8000.native.Connection(
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        database=os.environ.get("DB_NAME", "devcollab"),
        ssl_context=_ssl_context(),
        timeout=10,
    )


def get_conn():
    global _conn
    if _conn is not None:
        try:
            _conn.run("SELECT 1")
            return _conn
        except (InterfaceError, DatabaseError, OSError):
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None
    _conn = _connect()
    return _conn


def query(sql, **params):
    conn = get_conn()
    rows = conn.run(sql, **params)
    if not conn.columns:
        return []
    names = [c["name"] for c in conn.columns]
    return [dict(zip(names, row)) for row in rows]


def one(sql, **params):
    rows = query(sql, **params)
    return rows[0] if rows else None


def execute(sql, **params):
    conn = get_conn()
    conn.run(sql, **params)
    return conn.row_count


@contextmanager
def transaction():
    conn = get_conn()
    conn.run("START TRANSACTION")
    try:
        yield
        conn.run("COMMIT")
    except Exception:
        try:
            conn.run("ROLLBACK")
        except Exception:
            pass
        raise


def pg_code(error):
    if isinstance(error, DatabaseError) and error.args and isinstance(error.args[0], dict):
        return error.args[0].get("C")
    return None
