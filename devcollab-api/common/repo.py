from .db import execute, one, query
from .http import ApiError

USER_SELECT = """
SELECT u.id, u.username, u.email, u.display_name, u.bio, u.location, u.github_url, u.created_at,
       COALESCE((SELECT array_agg(s.name ORDER BY s.name)
                 FROM user_skills us JOIN skills s ON s.id = us.skill_id
                 WHERE us.user_id = u.id), '{}') AS skills,
       (SELECT count(*) FROM follows f WHERE f.followed_id = u.id) AS followers_count,
       (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
       EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followed_id = u.id) AS is_following
FROM users u
"""


def user_to_json(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "displayName": row["display_name"],
        "bio": row["bio"],
        "location": row["location"],
        "githubUrl": row["github_url"],
        "skills": list(row["skills"] or []),
        "followersCount": int(row["followers_count"]),
        "followingCount": int(row["following_count"]),
        "isFollowing": bool(row["is_following"]),
        "createdAt": row["created_at"],
    }


def find_users(viewer, where="TRUE", order="u.username", **params):
    rows = query(f"{USER_SELECT} WHERE {where} ORDER BY {order}", viewer=viewer, **params)
    return [user_to_json(r) for r in rows]


def get_user(user_id, viewer):
    users = find_users(viewer, "u.id = :id", id=user_id)
    if not users:
        raise ApiError(404, "Utilisateur introuvable")
    return users[0]


PROJECT_SELECT = """
SELECT p.id, p.name, p.description, p.repo_url, p.owner_id, o.username AS owner_name, p.created_at, p.updated_at,
       COALESCE((SELECT array_agg(t.name ORDER BY t.name)
                 FROM project_technologies pt JOIN technologies t ON t.id = pt.technology_id
                 WHERE pt.project_id = p.id), '{}') AS technologies,
       COALESCE((SELECT json_agg(json_build_object('id', mu.id, 'username', mu.username) ORDER BY m.joined_at)
                 FROM project_members m JOIN users mu ON mu.id = m.user_id
                 WHERE m.project_id = p.id), '[]'::json) AS contributors,
       (SELECT count(*) FROM pull_requests pr WHERE pr.project_id = p.id AND pr.status = 'open') AS open_prs
FROM projects p
JOIN users o ON o.id = p.owner_id
"""


def project_to_json(row):
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row["description"],
        "repoUrl": row["repo_url"],
        "technologies": list(row["technologies"] or []),
        "ownerId": row["owner_id"],
        "ownerName": row["owner_name"],
        "contributors": row["contributors"] or [],
        "openPullRequests": int(row["open_prs"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def find_projects(where="TRUE", order="p.created_at DESC", **params):
    rows = query(f"{PROJECT_SELECT} WHERE {where} ORDER BY {order}", **params)
    return [project_to_json(r) for r in rows]


def get_project(project_id):
    projects = find_projects("p.id = CAST(:id AS uuid)", id=project_id)
    if not projects:
        raise ApiError(404, "Projet introuvable")
    return projects[0]


def project_role(project_id, user_id):
    row = one(
        """
        SELECT p.owner_id = :uid AS is_owner,
               EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = :uid) AS is_member,
               p.name
        FROM projects p WHERE p.id = CAST(:id AS uuid)
        """,
        id=project_id,
        uid=user_id,
    )
    if not row:
        raise ApiError(404, "Projet introuvable")
    return row


PR_SELECT = """
SELECT pr.id, pr.project_id, p.name AS project_name, pr.author_id, a.username AS author_name,
       pr.title, pr.description, pr.source_branch, pr.target_branch, pr.status,
       pr.created_at, pr.updated_at, pr.merged_at, pr.closed_at,
       COALESCE((SELECT json_agg(json_build_object('path', f.path, 'patch', f.patch) ORDER BY f.position, f.id)
                 FROM pull_request_files f WHERE f.pull_request_id = pr.id), '[]'::json) AS files,
       (SELECT count(*) FROM reviews r WHERE r.pull_request_id = pr.id) AS reviews_count
FROM pull_requests pr
JOIN projects p ON p.id = pr.project_id
JOIN users a ON a.id = pr.author_id
"""


def pr_to_json(row):
    return {
        "id": str(row["id"]),
        "projectId": str(row["project_id"]),
        "projectName": row["project_name"],
        "authorId": row["author_id"],
        "authorName": row["author_name"],
        "title": row["title"],
        "description": row["description"],
        "sourceBranch": row["source_branch"],
        "targetBranch": row["target_branch"],
        "status": row["status"],
        "files": row["files"] or [],
        "reviewsCount": int(row["reviews_count"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "mergedAt": row["merged_at"],
        "closedAt": row["closed_at"],
    }


def find_pull_requests(where="TRUE", order="pr.updated_at DESC", **params):
    rows = query(f"{PR_SELECT} WHERE {where} ORDER BY {order}", **params)
    return [pr_to_json(r) for r in rows]


def get_pull_request(pr_id):
    prs = find_pull_requests("pr.id = CAST(:id AS uuid)", id=pr_id)
    if not prs:
        raise ApiError(404, "Pull request introuvable")
    return prs[0]


def set_names(table, link_table, owner_column, item_column, owner_id, names, owner_cast="text"):
    execute(f"DELETE FROM {link_table} WHERE {owner_column} = CAST(:owner AS {owner_cast})", owner=owner_id)
    if not names:
        return
    execute(
        f"INSERT INTO {table} (name) SELECT unnest(CAST(:names AS text[])) ON CONFLICT ((lower(name))) DO NOTHING",
        names=names,
    )
    execute(
        f"""
        INSERT INTO {link_table} ({owner_column}, {item_column})
        SELECT CAST(:owner AS {owner_cast}), t.id FROM {table} t
        WHERE lower(t.name) = ANY (SELECT lower(n) FROM unnest(CAST(:names AS text[])) AS n)
        ON CONFLICT DO NOTHING
        """,
        owner=owner_id,
        names=names,
    )


def log_activity(activity_type, actor_id, project_id=None, target_id=None, target_label=None):
    execute(
        """
        INSERT INTO activities (type, actor_id, project_id, target_id, target_label)
        VALUES (:type, :actor, CAST(:project AS uuid), :target, :label)
        """,
        type=activity_type,
        actor=actor_id,
        project=project_id,
        target=target_id,
        label=target_label,
    )
