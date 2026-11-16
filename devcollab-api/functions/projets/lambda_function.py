from common.auth import authenticate
from common.db import execute, one, query, transaction
from common.http import ApiError, Router
from common.repo import find_projects, get_project, log_activity, project_role, set_names
from common.validation import name_list, one_of, optional_str, optional_url, required_str

router = Router()


def _payload(body):
    return {
        "name": required_str(body, "name", "Nom du projet", 80),
        "description": required_str(body, "description", "Description", 5000),
        "repo_url": optional_url(body, "repoUrl", "URL du dépôt"),
        "technologies": name_list(body, "technologies", "Technologies"),
    }


def _ensure_unique_name(name, exclude_id=None):
    row = one(
        "SELECT 1 FROM projects WHERE lower(name) = lower(:name) AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))",
        name=name,
        exclude=exclude_id,
    )
    if row:
        raise ApiError(409, "Un projet porte déjà ce nom")


def _require_owner(project_id, user_id, message):
    role = project_role(project_id, user_id)
    if not role["is_owner"]:
        raise ApiError(403, message)
    return role


@router.route("GET", "/projects")
def list_projects(req):
    conditions = ["TRUE"]
    params = {}
    if req.query.get("q"):
        conditions.append("(p.name ILIKE :q OR p.description ILIKE :q)")
        params["q"] = f"%{req.query['q'].strip()}%"
    if req.query.get("tech"):
        conditions.append(
            """EXISTS (SELECT 1 FROM project_technologies pt JOIN technologies t ON t.id = pt.technology_id
                       WHERE pt.project_id = p.id AND lower(t.name) = lower(:tech))"""
        )
        params["tech"] = req.query["tech"].strip()
    if req.query.get("ownerId"):
        conditions.append(
            "(p.owner_id = :owner OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = :owner))"
        )
        params["owner"] = req.query["ownerId"]
    return find_projects(" AND ".join(conditions), **params)


@router.route("POST", "/projects")
def create_project(req):
    data = _payload(req.body)
    _ensure_unique_name(data["name"])
    with transaction():
        row = one(
            """
            INSERT INTO projects (name, description, repo_url, owner_id)
            VALUES (:name, :description, :repo_url, :owner)
            RETURNING id
            """,
            name=data["name"],
            description=data["description"],
            repo_url=data["repo_url"],
            owner=req.user.id,
        )
        project_id = str(row["id"])
        set_names("technologies", "project_technologies", "project_id", "technology_id", project_id, data["technologies"], "uuid")
        log_activity("project_created", req.user.id, project_id=project_id, target_label=data["name"])
    return 201, get_project(project_id)


@router.route("GET", "/projects/{id}")
def get_one(req):
    return get_project(req.params["id"])


@router.route("PUT", "/projects/{id}")
def update_project(req):
    project_id = req.params["id"]
    _require_owner(project_id, req.user.id, "Seul le propriétaire peut modifier ce projet")
    data = _payload(req.body)
    _ensure_unique_name(data["name"], project_id)
    with transaction():
        execute(
            """
            UPDATE projects SET name = :name, description = :description, repo_url = :repo_url, updated_at = now()
            WHERE id = CAST(:id AS uuid)
            """,
            id=project_id,
            name=data["name"],
            description=data["description"],
            repo_url=data["repo_url"],
        )
        set_names("technologies", "project_technologies", "project_id", "technology_id", project_id, data["technologies"], "uuid")
    return get_project(project_id)


@router.route("DELETE", "/projects/{id}")
def delete_project(req):
    project_id = req.params["id"]
    _require_owner(project_id, req.user.id, "Seul le propriétaire peut supprimer ce projet")
    execute("DELETE FROM projects WHERE id = CAST(:id AS uuid)", id=project_id)
    return 204, None


CONTRIBUTION_SELECT = """
SELECT c.id, c.project_id, c.user_id, u.username, c.message, c.status, c.created_at, c.decided_at
FROM contribution_requests c JOIN users u ON u.id = c.user_id
"""


def _contribution_json(row):
    return {
        "id": str(row["id"]),
        "projectId": str(row["project_id"]),
        "userId": row["user_id"],
        "username": row["username"],
        "message": row["message"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "decidedAt": row["decided_at"],
    }


def _get_contribution(contribution_id):
    row = one(f"{CONTRIBUTION_SELECT} WHERE c.id = CAST(:id AS uuid)", id=contribution_id)
    if not row:
        raise ApiError(404, "Demande de contribution introuvable")
    return row


@router.route("GET", "/projects/{id}/contributions")
def list_contributions(req):
    project_role(req.params["id"], req.user.id)
    rows = query(
        f"{CONTRIBUTION_SELECT} WHERE c.project_id = CAST(:id AS uuid) ORDER BY c.created_at DESC",
        id=req.params["id"],
    )
    return [_contribution_json(r) for r in rows]


@router.route("POST", "/projects/{id}/contributions")
def request_contribution(req):
    project_id = req.params["id"]
    message = required_str(req.body, "message", "Message", 2000)
    role = project_role(project_id, req.user.id)
    if role["is_owner"] or role["is_member"]:
        raise ApiError(400, "Vous contribuez déjà à ce projet")
    pending = one(
        "SELECT 1 FROM contribution_requests WHERE project_id = CAST(:p AS uuid) AND user_id = :u AND status = 'pending'",
        p=project_id,
        u=req.user.id,
    )
    if pending:
        raise ApiError(409, "Une demande est déjà en attente pour ce projet")
    with transaction():
        row = one(
            """
            INSERT INTO contribution_requests (project_id, user_id, message)
            VALUES (CAST(:p AS uuid), :u, :message) RETURNING id
            """,
            p=project_id,
            u=req.user.id,
            message=message,
        )
        log_activity("contribution_requested", req.user.id, project_id=project_id, target_label=role["name"])
    return 201, _contribution_json(_get_contribution(str(row["id"])))


@router.route("PUT", "/projects/{id}/contributions/{cid}")
def decide_contribution(req):
    project_id = req.params["id"]
    status = one_of(req.body.get("status"), ["accepted", "rejected"], "status")
    _require_owner(project_id, req.user.id, "Seul le propriétaire peut traiter les demandes de contribution")
    contribution = _get_contribution(req.params["cid"])
    if str(contribution["project_id"]) != project_id:
        raise ApiError(404, "Demande de contribution introuvable")
    if contribution["status"] != "pending":
        raise ApiError(409, "Cette demande a déjà été traitée")
    with transaction():
        execute(
            "UPDATE contribution_requests SET status = :status, decided_at = now() WHERE id = CAST(:id AS uuid)",
            status=status,
            id=req.params["cid"],
        )
        if status == "accepted":
            execute(
                "INSERT INTO project_members (project_id, user_id) VALUES (CAST(:p AS uuid), :u) ON CONFLICT DO NOTHING",
                p=project_id,
                u=contribution["user_id"],
            )
            log_activity(
                "contribution_accepted",
                req.user.id,
                project_id=project_id,
                target_id=contribution["user_id"],
                target_label=contribution["username"],
            )
    return _contribution_json(_get_contribution(req.params["cid"]))


def lambda_handler(event, context):
    return router.handle(event, authenticate)
