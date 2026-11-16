import base64
import importlib.util
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qsl, urlsplit

from env import ROOT, load_env

load_env()
sys.path.insert(0, str(ROOT))

FUNCTIONS = {
    "users": "utilisateurs",
    "projects": "projets",
    "pull-requests": "pull_requests",
    "reviews": "reviews",
    "activity": "activite",
}


def _load(name):
    spec = importlib.util.spec_from_file_location(f"fn_{name}", ROOT / "functions" / name / "lambda_function.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.lambda_handler


HANDLERS = {prefix: _load(name) for prefix, name in FUNCTIONS.items()}


def _claims(header):
    if not header:
        return None
    token = header.split(" ", 1)[-1]
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except (IndexError, ValueError):
        return None


class Handler(BaseHTTPRequestHandler):
    def _dispatch(self):
        url = urlsplit(self.path)
        prefix = url.path.strip("/").split("/")[0]
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8") if length else None
        claims = _claims(self.headers.get("Authorization"))
        event = {
            "httpMethod": self.command,
            "path": url.path,
            "queryStringParameters": dict(parse_qsl(url.query)) or None,
            "headers": dict(self.headers),
            "body": body,
            "requestContext": {"stage": "local", "authorizer": {"claims": claims} if claims else {}},
        }
        handler = HANDLERS.get(prefix)
        if handler:
            result = handler(event, None)
        else:
            result = {"statusCode": 404, "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}, "body": json.dumps({"message": "Route introuvable"})}
        payload = (result.get("body") or "").encode("utf-8")
        self.send_response(result["statusCode"])
        for key, value in (result.get("headers") or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PUT = do_DELETE = do_OPTIONS = _dispatch


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3001"))
    print(f"API locale sur http://localhost:{port} (jetons non vérifiés : usage local uniquement)")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
