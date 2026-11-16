def make_project(api, user="alice", name="kanban-lite", techs=("React", "TypeScript")):
    res = api("POST", "/projects", user, {"name": name, "description": "Un kanban", "technologies": list(techs)})
    assert res.status == 201, res
    return res.json


def add_member(api, project_id, owner, member):
    c = api("POST", f"/projects/{project_id}/contributions", member, {"message": "Je veux aider"})
    assert c.status == 201, c
    r = api("PUT", f"/projects/{project_id}/contributions/{c.json['id']}", owner, {"status": "accepted"})
    assert r.status == 200, r


def make_pr(api, project_id, user="alice"):
    res = api(
        "POST",
        "/pull-requests",
        user,
        {
            "projectId": project_id,
            "title": "Raccourcis clavier",
            "description": "Ajout",
            "sourceBranch": "feat/keys",
            "targetBranch": "main",
            "files": [{"path": "src/a.ts", "patch": "@@ -0,0 +1,2 @@\n+a\n+b"}],
        },
    )
    assert res.status == 201, res
    return res.json


def test_requires_auth(api):
    assert api("GET", "/users/me", user=None).status == 401


def test_cors_preflight(api):
    from conftest import HANDLERS

    raw = HANDLERS["users"]({"httpMethod": "OPTIONS", "path": "/users/me"}, None)
    assert raw["statusCode"] == 204
    assert raw["headers"]["Access-Control-Allow-Origin"] == "*"


def test_unknown_route_and_method(api):
    assert api("GET", "/users/x/unknown").status == 404
    assert api("PATCH", "/users/me").status == 405


def test_me_auto_provisioned_and_update(api):
    me = api("GET", "/users/me")
    assert me.status == 200
    assert me.json["username"] == "alice"
    assert me.json["displayName"] == "alice"
    res = api("PUT", "/users/me", body={"displayName": "Alice M", "bio": "Rust", "skills": ["Rust", "rust", "Go"], "githubUrl": "https://github.com/a"})
    assert res.status == 200, res
    assert res.json["skills"] == ["Go", "Rust"]
    assert api("PUT", "/users/me", body={"displayName": ""}).status == 400
    assert api("PUT", "/users/me", body={"displayName": "x", "githubUrl": "ftp://x"}).status == 400


def test_list_users_filters(api):
    api("PUT", "/users/me", "alice", {"displayName": "Alice", "skills": ["Rust"]})
    api("PUT", "/users/me", "bob", {"displayName": "Bob", "skills": ["Python"]})
    assert [u["username"] for u in api("GET", "/users").json] == ["alice", "bob"]
    assert [u["username"] for u in api("GET", "/users", query={"skill": "python"}).json] == ["bob"]
    assert [u["username"] for u in api("GET", "/users", query={"q": "ali"}).json] == ["alice"]
    assert api("GET", "/users/nope").status == 404


def test_follow_flow(api):
    api("GET", "/users/me", "bob")
    assert api("POST", "/users/sub-alice/follow", "alice").status == 400
    assert api("POST", "/users/sub-bob/follow", "alice").status == 204
    assert api("POST", "/users/sub-bob/follow", "alice").status == 204
    bob = api("GET", "/users/sub-bob", "alice").json
    assert bob["followersCount"] == 1 and bob["isFollowing"] is True
    assert [u["username"] for u in api("GET", "/users/sub-bob/followers").json] == ["alice"]
    assert [u["username"] for u in api("GET", "/users/sub-alice/following").json] == ["bob"]
    feed = api("GET", "/activity").json
    assert len(feed) == 1 and feed[0]["type"] == "user_followed"
    assert api("DELETE", "/users/sub-bob/follow", "alice").status == 204
    assert api("GET", "/users/sub-bob", "alice").json["followersCount"] == 0
    assert api("POST", "/users/ghost/follow", "alice").status == 404


def test_project_crud(api):
    p = make_project(api)
    assert p["ownerName"] == "alice" and p["technologies"] == ["React", "TypeScript"]
    assert api("POST", "/projects", "bob", {"name": "KANBAN-lite", "description": "x"}).status == 409
    assert api("POST", "/projects", "bob", {"name": "", "description": "x"}).status == 400
    assert len(api("GET", "/projects", query={"tech": "react"}).json) == 1
    assert len(api("GET", "/projects", query={"q": "nothing"}).json) == 0
    assert api("PUT", f"/projects/{p['id']}", "bob", {"name": "x", "description": "y"}).status == 403
    upd = api("PUT", f"/projects/{p['id']}", "alice", {"name": "kanban-pro", "description": "y", "technologies": ["Vue"]})
    assert upd.status == 200 and upd.json["technologies"] == ["Vue"] and upd.json["name"] == "kanban-pro"
    assert api("GET", "/projects/not-a-uuid").status == 404
    assert api("DELETE", f"/projects/{p['id']}", "bob").status == 403
    assert api("DELETE", f"/projects/{p['id']}", "alice").status == 204
    assert api("GET", f"/projects/{p['id']}").status == 404


def test_contributions(api):
    p = make_project(api)
    assert api("POST", f"/projects/{p['id']}/contributions", "alice", {"message": "moi"}).status == 400
    c = api("POST", f"/projects/{p['id']}/contributions", "bob", {"message": "Je veux aider"})
    assert c.status == 201 and c.json["status"] == "pending"
    assert api("POST", f"/projects/{p['id']}/contributions", "bob", {"message": "encore"}).status == 409
    assert api("PUT", f"/projects/{p['id']}/contributions/{c.json['id']}", "bob", {"status": "accepted"}).status == 403
    assert api("PUT", f"/projects/{p['id']}/contributions/{c.json['id']}", "alice", {"status": "maybe"}).status == 400
    ok = api("PUT", f"/projects/{p['id']}/contributions/{c.json['id']}", "alice", {"status": "accepted"})
    assert ok.status == 200 and ok.json["status"] == "accepted"
    assert api("PUT", f"/projects/{p['id']}/contributions/{c.json['id']}", "alice", {"status": "rejected"}).status == 409
    project = api("GET", f"/projects/{p['id']}").json
    assert [m["username"] for m in project["contributors"]] == ["bob"]
    assert len(api("GET", "/projects", query={"ownerId": "sub-bob"}).json) == 1
    types = [a["type"] for a in api("GET", "/activity", query={"projectId": p["id"]}).json]
    assert types == ["contribution_accepted", "contribution_requested", "project_created"]


def test_pull_request_lifecycle(api):
    p = make_project(api)
    api("GET", "/users/me", "carol")
    body = {"projectId": p["id"], "title": "t", "sourceBranch": "a", "targetBranch": "main", "files": []}
    assert api("POST", "/pull-requests", "carol", body).status == 403
    assert api("POST", "/pull-requests", "alice", {**body, "sourceBranch": "main"}).status == 400
    add_member(api, p["id"], "alice", "bob")
    pr = make_pr(api, p["id"], "bob")
    assert pr["status"] == "open" and pr["files"][0]["path"] == "src/a.ts" and pr["authorName"] == "bob"
    assert api("GET", "/projects/" + p["id"]).json["openPullRequests"] == 1
    assert len(api("GET", "/pull-requests", query={"projectId": p["id"], "status": "open"}).json) == 1
    assert api("GET", "/pull-requests", query={"status": "weird"}).status == 400
    assert api("PUT", f"/pull-requests/{pr['id']}", "alice", {"title": "hack"}).status == 403
    edit = api("PUT", f"/pull-requests/{pr['id']}", "bob", {"title": "Nouveau titre"})
    assert edit.status == 200 and edit.json["title"] == "Nouveau titre"
    assert api("PUT", f"/pull-requests/{pr['id']}", "bob", {"status": "merged"}).status == 403
    assert api("PUT", f"/pull-requests/{pr['id']}", "carol", {"status": "closed"}).status == 403
    closed = api("PUT", f"/pull-requests/{pr['id']}", "bob", {"status": "closed"})
    assert closed.json["status"] == "closed" and closed.json["closedAt"]
    assert api("PUT", f"/pull-requests/{pr['id']}", "alice", {"status": "merged"}).status == 409
    reopened = api("PUT", f"/pull-requests/{pr['id']}", "alice", {"status": "open"})
    assert reopened.json["status"] == "open" and reopened.json["closedAt"] is None
    merged = api("PUT", f"/pull-requests/{pr['id']}", "alice", {"status": "merged"})
    assert merged.status == 200 and merged.json["status"] == "merged" and merged.json["mergedAt"]
    assert api("PUT", f"/pull-requests/{pr['id']}", "alice", {"status": "open"}).status == 409
    types = [a["type"] for a in api("GET", "/activity", query={"userId": "sub-alice"}).json]
    assert types[:2] == ["pr_merged", "contribution_accepted"]


def test_reviews(api):
    p = make_project(api)
    add_member(api, p["id"], "alice", "bob")
    pr = make_pr(api, p["id"], "bob")
    assert api("GET", "/reviews").status == 400
    assert api("POST", "/reviews", "bob", {"pullRequestId": pr["id"], "verdict": "approved", "body": "lgtm"}).status == 400
    assert api("POST", "/reviews", "alice", {"pullRequestId": pr["id"], "verdict": "approved"}).status == 400
    bad_file = {"pullRequestId": pr["id"], "verdict": "commented", "comments": [{"file": "x.ts", "line": 1, "body": "?"}]}
    assert api("POST", "/reviews", "alice", bad_file).status == 400
    r = api(
        "POST",
        "/reviews",
        "alice",
        {
            "pullRequestId": pr["id"],
            "verdict": "changes_requested",
            "body": "Quelques retours",
            "comments": [{"file": "src/a.ts", "line": 2, "body": "Renommer b"}],
        },
    )
    assert r.status == 201, r
    assert r.json["reviewerName"] == "alice"
    assert r.json["comments"][0]["line"] == 2 and r.json["comments"][0]["authorName"] == "alice"
    own = api("POST", "/reviews", "bob", {"pullRequestId": pr["id"], "verdict": "commented", "body": "Corrigé"})
    assert own.status == 201
    listed = api("GET", "/reviews", query={"pullRequestId": pr["id"]}).json
    assert [x["verdict"] for x in listed] == ["changes_requested", "commented"]
    assert api("GET", f"/reviews/{r.json['id']}").status == 200
    assert api("GET", f"/pull-requests/{pr['id']}").json["reviewsCount"] == 2
    api("PUT", f"/pull-requests/{pr['id']}", "alice", {"status": "merged"})
    assert api("POST", "/reviews", "alice", {"pullRequestId": pr["id"], "body": "trop tard"}).status == 409


def test_activity_limit_and_before(api):
    for i in range(5):
        make_project(api, name=f"p{i}")
    feed = api("GET", "/activity", query={"limit": "2"}).json
    assert len(feed) == 2
    older = api("GET", "/activity", query={"before": feed[-1]["createdAt"]}).json
    assert len(older) == 3
    assert api("GET", "/activity", query={"before": "hier"}).status == 400
    assert feed[0]["projectName"] == "p4"
