from datetime import datetime

from common.auth import authenticate
from common.db import query
from common.http import ApiError, Router
from common.validation import int_param

router = Router()


@router.route("GET", "/activity")
def list_activity(req):
    conditions = ["TRUE"]
    params = {"limit": int_param(req.query, "limit", 50, 1, 100)}
    if req.query.get("userId"):
        conditions.append("(a.actor_id = :user OR a.target_id = :user)")
        params["user"] = req.query["userId"]
    if req.query.get("projectId"):
        conditions.append("a.project_id = CAST(:project AS uuid)")
        params["project"] = req.query["projectId"]
    if req.query.get("before"):
        try:
            params["before"] = datetime.fromisoformat(req.query["before"].replace("Z", "+00:00"))
        except ValueError:
            raise ApiError(400, "Le paramètre « before » doit être une date ISO 8601")
        conditions.append("a.created_at < :before")
    rows = query(
        f"""
        SELECT a.id, a.type, a.actor_id, u.username AS actor_name, a.project_id, p.name AS project_name,
               a.target_id, a.target_label, a.created_at
        FROM activities a
        JOIN users u ON u.id = a.actor_id
        LEFT JOIN projects p ON p.id = a.project_id
        WHERE {" AND ".join(conditions)}
        ORDER BY a.created_at DESC
        LIMIT :limit
        """,
        **params,
    )
    return [
        {
            "id": str(r["id"]),
            "type": r["type"],
            "actorId": r["actor_id"],
            "actorName": r["actor_name"],
            "projectId": str(r["project_id"]) if r["project_id"] else None,
            "projectName": r["project_name"],
            "targetId": r["target_id"],
            "targetLabel": r["target_label"],
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


def lambda_handler(event, context):
    return router.handle(event, authenticate)
