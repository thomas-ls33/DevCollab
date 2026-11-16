from common.auth import authenticate
from common.db import execute, one, transaction
from common.http import ApiError, Router
from common.repo import find_pull_requests, get_pull_request, log_activity, project_role
from common.validation import one_of, optional_str, required_str

router = Router()

STATUSES = ["open", "closed", "merged"]
MAX_FILES = 50
MAX_PATCH = 200_000


def _files(body):
    files = body.get("files", [])
    if not isinstance(files, list):
        raise ApiError(400, "Le champ « files » doit être une liste")
    if len(files) > MAX_FILES:
        raise ApiError(400, f"Une pull request est limitée à {MAX_FILES} fichiers")
    result = []
    seen = set()
    for f in files:
        if not isinstance(f, dict):
            raise ApiError(400, "Chaque fichier doit contenir « path » et « patch »")
        path = required_str(f, "path", "Chemin du fichier", 255)
        patch = f.get("patch")
        if not isinstance(patch, str) or not patch.strip():
            raise ApiError(400, f"Le contenu du fichier « {path} » est vide")
        if len(patch) > MAX_PATCH:
            raise ApiError(400, f"Le diff du fichier « {path} » est trop volumineux")
        if path in seen:
            raise ApiError(400, f"Le fichier « {path} » apparaît plusieurs fois")
        seen.add(path)
        result.append({"path": path, "patch": patch})
    return result


@router.route("GET", "/pull-requests")
def list_pull_requests(req):
    conditions = ["TRUE"]
    params = {}
    if req.query.get("projectId"):
        conditions.append("pr.project_id = CAST(:project AS uuid)")
        params["project"] = req.query["projectId"]
    if req.query.get("authorId"):
        conditions.append("pr.author_id = :author")
        params["author"] = req.query["authorId"]
    if req.query.get("status"):
        conditions.append("pr.status = :status")
        params["status"] = one_of(req.query["status"], STATUSES, "status")
    return find_pull_requests(" AND ".join(conditions), **params)


@router.route("POST", "/pull-requests")
def create_pull_request(req):
    body = req.body
    project_id = required_str(body, "projectId", "Projet", 64)
    title = required_str(body, "title", "Titre", 120)
    description = optional_str(body, "description", "Description", 20000, "")
    source = required_str(body, "sourceBranch", "Branche source", 100)
    target = required_str(body, "targetBranch", "Branche cible", 100)
    if source == target:
        raise ApiError(400, "Les branches source et cible doivent être différentes")
    files = _files(body)
    role = project_role(project_id, req.user.id)
    if not (role["is_owner"] or role["is_member"]):
        raise ApiError(403, "Vous devez être contributeur du projet pour ouvrir une pull request")
    with transaction():
        row = one(
            """
            INSERT INTO pull_requests (project_id, author_id, title, description, source_branch, target_branch)
            VALUES (CAST(:project AS uuid), :author, :title, :description, :source, :target)
            RETURNING id
            """,
            project=project_id,
            author=req.user.id,
            title=title,
            description=description,
            source=source,
            target=target,
        )
        pr_id = str(row["id"])
        for position, f in enumerate(files):
            execute(
                """
                INSERT INTO pull_request_files (pull_request_id, path, patch, position)
                VALUES (CAST(:pr AS uuid), :path, :patch, :position)
                """,
                pr=pr_id,
                path=f["path"],
                patch=f["patch"],
                position=position,
            )
        log_activity("pr_opened", req.user.id, project_id=project_id, target_id=pr_id, target_label=title)
    return 201, get_pull_request(pr_id)


@router.route("GET", "/pull-requests/{id}")
def get_one(req):
    return get_pull_request(req.params["id"])


@router.route("PUT", "/pull-requests/{id}")
def update_pull_request(req):
    pr = get_pull_request(req.params["id"])
    body = req.body
    role = project_role(pr["projectId"], req.user.id)
    is_author = pr["authorId"] == req.user.id
    is_owner = role["is_owner"]

    if pr["status"] == "merged":
        raise ApiError(409, "Une pull request mergée ne peut plus être modifiée")

    updates = {}
    if "title" in body or "description" in body:
        if not is_author:
            raise ApiError(403, "Seul l'auteur peut modifier le titre ou la description")
        if pr["status"] != "open":
            raise ApiError(409, "Seule une pull request ouverte peut être modifiée")
        if "title" in body:
            updates["title"] = required_str(body, "title", "Titre", 120)
        if "description" in body:
            updates["description"] = optional_str(body, "description", "Description", 20000, "")

    new_status = None
    if body.get("status") is not None:
        new_status = one_of(body["status"], STATUSES, "status")
        if new_status == pr["status"]:
            new_status = None
        elif new_status == "merged":
            if not is_owner:
                raise ApiError(403, "Seul le propriétaire du projet peut merger")
            if pr["status"] != "open":
                raise ApiError(409, "Seule une pull request ouverte peut être mergée")
        elif not (is_author or is_owner):
            raise ApiError(403, "Seuls l'auteur et le propriétaire du projet peuvent changer le statut")

    if not updates and not new_status:
        return pr

    with transaction():
        if updates:
            sets = ", ".join(f"{k} = :{k}" for k in updates)
            execute(f"UPDATE pull_requests SET {sets}, updated_at = now() WHERE id = CAST(:id AS uuid)", id=pr["id"], **updates)
        if new_status:
            execute(
                """
                UPDATE pull_requests SET status = :status, updated_at = now(),
                       merged_at = CASE WHEN :merged THEN now() ELSE merged_at END,
                       closed_at = CASE WHEN :closed THEN now() WHEN :reopened THEN NULL ELSE closed_at END
                WHERE id = CAST(:id AS uuid)
                """,
                id=pr["id"],
                status=new_status,
                merged=new_status == "merged",
                closed=new_status == "closed",
                reopened=new_status == "open",
            )
            if new_status in ("merged", "closed"):
                log_activity(
                    "pr_merged" if new_status == "merged" else "pr_closed",
                    req.user.id,
                    project_id=pr["projectId"],
                    target_id=pr["id"],
                    target_label=updates.get("title", pr["title"]),
                )
    return get_pull_request(pr["id"])


def lambda_handler(event, context):
    return router.handle(event, authenticate)
