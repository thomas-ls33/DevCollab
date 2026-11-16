from common.auth import authenticate
from common.db import execute, one, query, transaction
from common.http import ApiError, Router
from common.repo import get_pull_request, log_activity
from common.validation import one_of, optional_str, required_str

router = Router()

VERDICTS = ["approved", "changes_requested", "commented"]
MAX_COMMENTS = 200

REVIEW_SELECT = """
SELECT r.id, r.pull_request_id, r.reviewer_id, u.username AS reviewer_name, r.verdict, r.body, r.created_at,
       COALESCE((SELECT json_agg(json_build_object(
                    'id', c.id, 'file', c.file_path, 'line', c.line, 'body', c.body,
                    'authorId', r.reviewer_id, 'authorName', u.username, 'createdAt', c.created_at
                 ) ORDER BY c.file_path, c.line, c.created_at)
                 FROM review_comments c WHERE c.review_id = r.id), '[]'::json) AS comments
FROM reviews r JOIN users u ON u.id = r.reviewer_id
"""


def _json(row):
    return {
        "id": str(row["id"]),
        "pullRequestId": str(row["pull_request_id"]),
        "reviewerId": row["reviewer_id"],
        "reviewerName": row["reviewer_name"],
        "verdict": row["verdict"],
        "body": row["body"],
        "comments": row["comments"] or [],
        "createdAt": row["created_at"],
    }


def _get(review_id):
    row = one(f"{REVIEW_SELECT} WHERE r.id = CAST(:id AS uuid)", id=review_id)
    if not row:
        raise ApiError(404, "Review introuvable")
    return _json(row)


def _comments(body, files):
    comments = body.get("comments", [])
    if not isinstance(comments, list):
        raise ApiError(400, "Le champ « comments » doit être une liste")
    if len(comments) > MAX_COMMENTS:
        raise ApiError(400, f"Une review est limitée à {MAX_COMMENTS} commentaires")
    result = []
    for c in comments:
        if not isinstance(c, dict):
            raise ApiError(400, "Chaque commentaire doit contenir « file », « line » et « body »")
        file = required_str(c, "file", "Fichier", 255)
        if file not in files:
            raise ApiError(400, f"Le fichier « {file} » ne fait pas partie de la pull request")
        line = c.get("line")
        if not isinstance(line, int) or isinstance(line, bool) or line < 0:
            raise ApiError(400, "Le numéro de ligne doit être un entier positif")
        result.append({"file": file, "line": line, "body": required_str(c, "body", "Commentaire", 5000)})
    return result


@router.route("GET", "/reviews")
def list_reviews(req):
    pr_id = req.query.get("pullRequestId")
    if not pr_id:
        raise ApiError(400, "Le paramètre « pullRequestId » est obligatoire")
    get_pull_request(pr_id)
    rows = query(f"{REVIEW_SELECT} WHERE r.pull_request_id = CAST(:pr AS uuid) ORDER BY r.created_at", pr=pr_id)
    return [_json(r) for r in rows]


@router.route("GET", "/reviews/{id}")
def get_one(req):
    return _get(req.params["id"])


@router.route("POST", "/reviews")
def create_review(req):
    body = req.body
    pr = get_pull_request(required_str(body, "pullRequestId", "Pull request", 64))
    verdict = one_of(body.get("verdict", "commented"), VERDICTS, "verdict")
    text = optional_str(body, "body", "Commentaire", 20000, "")
    comments = _comments(body, {f["path"] for f in pr["files"]})
    if pr["status"] != "open":
        raise ApiError(409, "Seule une pull request ouverte peut être reviewée")
    if pr["authorId"] == req.user.id and verdict != "commented":
        raise ApiError(400, "Vous ne pouvez pas approuver ou rejeter votre propre pull request")
    if not text and not comments:
        raise ApiError(400, "Une review doit contenir un commentaire général ou au moins un commentaire de ligne")
    with transaction():
        row = one(
            """
            INSERT INTO reviews (pull_request_id, reviewer_id, verdict, body)
            VALUES (CAST(:pr AS uuid), :reviewer, :verdict, :body) RETURNING id
            """,
            pr=pr["id"],
            reviewer=req.user.id,
            verdict=verdict,
            body=text,
        )
        review_id = str(row["id"])
        for c in comments:
            execute(
                """
                INSERT INTO review_comments (review_id, file_path, line, body)
                VALUES (CAST(:review AS uuid), :file, :line, :body)
                """,
                review=review_id,
                file=c["file"],
                line=c["line"],
                body=c["body"],
            )
        execute("UPDATE pull_requests SET updated_at = now() WHERE id = CAST(:id AS uuid)", id=pr["id"])
        log_activity("review_submitted", req.user.id, project_id=pr["projectId"], target_id=pr["id"], target_label=pr["title"])
    return 201, _get(review_id)


def lambda_handler(event, context):
    return router.handle(event, authenticate)
