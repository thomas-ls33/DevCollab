from common.auth import authenticate
from common.db import execute, one, transaction
from common.http import ApiError, Router
from common.repo import find_users, get_user, log_activity, set_names
from common.validation import name_list, optional_str, optional_url, required_str

router = Router()


@router.route("GET", "/users/me")
def get_me(req):
    return get_user(req.user.id, req.user.id)


@router.route("PUT", "/users/me")
def update_me(req):
    body = req.body
    display_name = required_str(body, "displayName", "Nom affiché", 100)
    bio = optional_str(body, "bio", "Bio", 280, "")
    location = optional_str(body, "location", "Localisation", 100)
    github_url = optional_url(body, "githubUrl", "Lien GitHub")
    skills = name_list(body, "skills", "Compétences")
    with transaction():
        execute(
            """
            UPDATE users SET display_name = :display_name, bio = :bio, location = :location,
                             github_url = :github_url, updated_at = now()
            WHERE id = :id
            """,
            id=req.user.id,
            display_name=display_name,
            bio=bio,
            location=location,
            github_url=github_url,
        )
        set_names("skills", "user_skills", "user_id", "skill_id", req.user.id, skills)
    return get_user(req.user.id, req.user.id)


@router.route("GET", "/users")
def list_users(req):
    conditions = ["TRUE"]
    params = {}
    if req.query.get("q"):
        conditions.append("(u.username ILIKE :q OR u.display_name ILIKE :q)")
        params["q"] = f"%{req.query['q'].strip()}%"
    if req.query.get("skill"):
        conditions.append(
            """EXISTS (SELECT 1 FROM user_skills us JOIN skills s ON s.id = us.skill_id
                       WHERE us.user_id = u.id AND lower(s.name) = lower(:skill))"""
        )
        params["skill"] = req.query["skill"].strip()
    return find_users(req.user.id, " AND ".join(conditions), **params)


@router.route("GET", "/users/{id}")
def get_one(req):
    return get_user(req.params["id"], req.user.id)


@router.route("POST", "/users/{id}/follow")
def follow(req):
    target_id = req.params["id"]
    if target_id == req.user.id:
        raise ApiError(400, "Impossible de se suivre soi-même")
    target = one("SELECT id, username FROM users WHERE id = :id", id=target_id)
    if not target:
        raise ApiError(404, "Utilisateur introuvable")
    with transaction():
        inserted = execute(
            "INSERT INTO follows (follower_id, followed_id) VALUES (:me, :id) ON CONFLICT DO NOTHING",
            me=req.user.id,
            id=target_id,
        )
        if inserted:
            log_activity("user_followed", req.user.id, target_id=target_id, target_label=target["username"])
    return 204, None


@router.route("DELETE", "/users/{id}/follow")
def unfollow(req):
    execute("DELETE FROM follows WHERE follower_id = :me AND followed_id = :id", me=req.user.id, id=req.params["id"])
    return 204, None


@router.route("GET", "/users/{id}/followers")
def followers(req):
    get_user(req.params["id"], req.user.id)
    return find_users(
        req.user.id,
        "u.id IN (SELECT follower_id FROM follows WHERE followed_id = :id)",
        id=req.params["id"],
    )


@router.route("GET", "/users/{id}/following")
def following(req):
    get_user(req.params["id"], req.user.id)
    return find_users(
        req.user.id,
        "u.id IN (SELECT followed_id FROM follows WHERE follower_id = :id)",
        id=req.params["id"],
    )


def lambda_handler(event, context):
    return router.handle(event, authenticate)
