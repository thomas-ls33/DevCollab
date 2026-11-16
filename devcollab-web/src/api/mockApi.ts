import { ApiError } from './http'
import { db, save, uid, type ProjectRow, type PullRequestRow, type ReviewRow } from './mockDb'
import type { Activity, ActivityType, Api, Project, PullRequest, Review, User } from './types'

const SESSION_KEY = 'devcollab.mock.session'

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 150 + Math.random() * 200))

const me = () => {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) throw new ApiError(401, 'Non authentifié')
  return JSON.parse(raw).id as string
}

const username = (id: string) => db().accounts.find((a) => a.id === id)?.username ?? 'inconnu'

const toUser = (id: string): User => {
  const acc = db().accounts.find((a) => a.id === id)
  const p = db().profiles[id]
  if (!acc || !p) throw new ApiError(404, 'Utilisateur introuvable')
  const current = localStorage.getItem(SESSION_KEY) ? me() : null
  return {
    id,
    username: acc.username,
    email: acc.email,
    displayName: p.displayName,
    bio: p.bio,
    location: p.location,
    githubUrl: p.githubUrl,
    skills: p.skills,
    followersCount: db().follows.filter((f) => f.to === id).length,
    followingCount: db().follows.filter((f) => f.from === id).length,
    isFollowing: current ? db().follows.some((f) => f.from === current && f.to === id) : false,
    createdAt: p.createdAt,
  }
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  repoUrl: row.repoUrl,
  technologies: row.technologies,
  ownerId: row.ownerId,
  ownerName: username(row.ownerId),
  contributors: row.contributorIds.map((id) => ({ id, username: username(id) })),
  openPullRequests: db().pullRequests.filter((pr) => pr.projectId === row.id && pr.status === 'open').length,
  createdAt: row.createdAt,
})

const toPr = (row: PullRequestRow): PullRequest => ({
  ...row,
  projectName: db().projects.find((p) => p.id === row.projectId)?.name ?? '',
  authorName: username(row.authorId),
  reviewsCount: db().reviews.filter((r) => r.pullRequestId === row.id).length,
})

const toReview = (row: ReviewRow): Review => ({ ...row, reviewerName: username(row.reviewerId) })

const findProject = (id: string) => {
  const p = db().projects.find((x) => x.id === id)
  if (!p) throw new ApiError(404, 'Projet introuvable')
  return p
}

const findPr = (id: string) => {
  const pr = db().pullRequests.find((x) => x.id === id)
  if (!pr) throw new ApiError(404, 'Pull request introuvable')
  return pr
}

const log = (type: ActivityType, extra: Partial<Activity> = {}) => {
  const actorId = me()
  db().activity.unshift({ id: uid(), type, actorId, actorName: username(actorId), createdAt: new Date().toISOString(), ...extra })
}

const includes = (a: string, b?: string) => !b || a.toLowerCase().includes(b.toLowerCase())

export const mockApi: Api = {
  getMe: async () => delay(toUser(me())),

  updateMe: async (data) => {
    const id = me()
    db().profiles[id] = { ...db().profiles[id], ...data }
    save()
    return delay(toUser(id))
  },

  listUsers: async (p) =>
    delay(
      db()
        .accounts.filter((a) => a.confirmed)
        .map((a) => toUser(a.id))
        .filter((u) => includes(u.username + ' ' + u.displayName, p?.q))
        .filter((u) => !p?.skill || u.skills.some((s) => s.toLowerCase() === p.skill!.toLowerCase())),
    ),

  getUser: async (id) => delay(toUser(id)),

  follow: async (id) => {
    const from = me()
    if (from === id) throw new ApiError(400, 'Impossible de se suivre soi-même')
    if (!db().follows.some((f) => f.from === from && f.to === id)) {
      db().follows.push({ from, to: id })
      log('user_followed', { targetId: id, targetLabel: username(id) })
      save()
    }
    return delay(undefined)
  },

  unfollow: async (id) => {
    const from = me()
    db().follows = db().follows.filter((f) => !(f.from === from && f.to === id))
    save()
    return delay(undefined)
  },

  getFollowers: async (id) => delay(db().follows.filter((f) => f.to === id).map((f) => toUser(f.from))),
  getFollowing: async (id) => delay(db().follows.filter((f) => f.from === id).map((f) => toUser(f.to))),

  listProjects: async (p) =>
    delay(
      db()
        .projects.filter((x) => includes(x.name + ' ' + x.description, p?.q))
        .filter((x) => !p?.tech || x.technologies.some((t) => t.toLowerCase() === p.tech!.toLowerCase()))
        .filter((x) => !p?.ownerId || x.ownerId === p.ownerId || x.contributorIds.includes(p.ownerId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toProject),
    ),

  getProject: async (id) => delay(toProject(findProject(id))),

  createProject: async (data) => {
    if (!data.name.trim()) throw new ApiError(400, 'Le nom du projet est obligatoire')
    if (db().projects.some((p) => p.name.toLowerCase() === data.name.toLowerCase()))
      throw new ApiError(409, 'Un projet porte déjà ce nom')
    const row: ProjectRow = { id: 'p-' + uid(), ...data, ownerId: me(), contributorIds: [], createdAt: new Date().toISOString() }
    db().projects.push(row)
    log('project_created', { projectId: row.id, projectName: row.name })
    save()
    return delay(toProject(row))
  },

  updateProject: async (id, data) => {
    const row = findProject(id)
    if (row.ownerId !== me()) throw new ApiError(403, 'Seul le propriétaire peut modifier ce projet')
    Object.assign(row, data)
    save()
    return delay(toProject(row))
  },

  deleteProject: async (id) => {
    const row = findProject(id)
    if (row.ownerId !== me()) throw new ApiError(403, 'Seul le propriétaire peut supprimer ce projet')
    db().projects = db().projects.filter((p) => p.id !== id)
    save()
    return delay(undefined)
  },

  listContributions: async (projectId) =>
    delay(db().contributions.filter((c) => c.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  requestContribution: async (projectId, message) => {
    const project = findProject(projectId)
    const userId = me()
    if (project.ownerId === userId || project.contributorIds.includes(userId))
      throw new ApiError(400, 'Vous contribuez déjà à ce projet')
    if (db().contributions.some((c) => c.projectId === projectId && c.userId === userId && c.status === 'pending'))
      throw new ApiError(409, 'Une demande est déjà en attente')
    const c = { id: 'c-' + uid(), projectId, userId, username: username(userId), message, status: 'pending' as const, createdAt: new Date().toISOString() }
    db().contributions.push(c)
    log('contribution_requested', { projectId, projectName: project.name })
    save()
    return delay(c)
  },

  updateContribution: async (projectId, id, status) => {
    const project = findProject(projectId)
    if (project.ownerId !== me()) throw new ApiError(403, 'Seul le propriétaire peut traiter les demandes')
    const c = db().contributions.find((x) => x.id === id)
    if (!c) throw new ApiError(404, 'Demande introuvable')
    c.status = status
    if (status === 'accepted' && !project.contributorIds.includes(c.userId)) {
      project.contributorIds.push(c.userId)
      log('contribution_accepted', { projectId, projectName: project.name, targetId: c.userId, targetLabel: c.username })
    }
    save()
    return delay(c)
  },

  listPullRequests: async (p) =>
    delay(
      db()
        .pullRequests.filter((x) => !p?.projectId || x.projectId === p.projectId)
        .filter((x) => !p?.authorId || x.authorId === p.authorId)
        .filter((x) => !p?.status || x.status === p.status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toPr),
    ),

  getPullRequest: async (id) => delay(toPr(findPr(id))),

  createPullRequest: async (data) => {
    const project = findProject(data.projectId)
    const userId = me()
    if (project.ownerId !== userId && !project.contributorIds.includes(userId))
      throw new ApiError(403, 'Vous devez être contributeur du projet pour ouvrir une pull request')
    const now = new Date().toISOString()
    const row: PullRequestRow = { id: 'pr-' + uid(), ...data, authorId: userId, status: 'open', createdAt: now, updatedAt: now }
    db().pullRequests.push(row)
    log('pr_opened', { projectId: project.id, projectName: project.name, targetId: row.id, targetLabel: row.title })
    save()
    return delay(toPr(row))
  },

  updatePullRequest: async (id, data) => {
    const row = findPr(id)
    const project = findProject(row.projectId)
    const userId = me()
    if (row.status === 'merged') throw new ApiError(400, 'Une pull request mergée ne peut plus être modifiée')
    if (data.status === 'merged' && project.ownerId !== userId)
      throw new ApiError(403, 'Seul le propriétaire du projet peut merger')
    if (data.status !== 'merged' && row.authorId !== userId && project.ownerId !== userId)
      throw new ApiError(403, 'Action non autorisée')
    Object.assign(row, data, { updatedAt: new Date().toISOString() })
    if (data.status === 'merged') log('pr_merged', { projectId: project.id, projectName: project.name, targetId: id, targetLabel: row.title })
    if (data.status === 'closed') log('pr_closed', { projectId: project.id, projectName: project.name, targetId: id, targetLabel: row.title })
    save()
    return delay(toPr(row))
  },

  listReviews: async (pullRequestId) =>
    delay(db().reviews.filter((r) => r.pullRequestId === pullRequestId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toReview)),

  createReview: async (data) => {
    const pr = findPr(data.pullRequestId)
    const userId = me()
    if (pr.authorId === userId && data.verdict !== 'commented')
      throw new ApiError(400, 'Vous ne pouvez pas approuver ou rejeter votre propre pull request')
    const now = new Date().toISOString()
    const row: ReviewRow = {
      id: 'r-' + uid(),
      pullRequestId: pr.id,
      reviewerId: userId,
      verdict: data.verdict,
      body: data.body,
      comments: data.comments.map((c) => ({ ...c, id: 'lc-' + uid(), authorId: userId, authorName: username(userId), createdAt: now })),
      createdAt: now,
    }
    db().reviews.push(row)
    pr.updatedAt = now
    log('review_submitted', { projectId: pr.projectId, projectName: findProject(pr.projectId).name, targetId: pr.id, targetLabel: pr.title })
    save()
    return delay(toReview(row))
  },

  listActivity: async (p) =>
    delay(
      db()
        .activity.filter((a) => !p?.userId || a.actorId === p.userId || a.targetId === p.userId)
        .filter((a) => !p?.projectId || a.projectId === p.projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50),
    ),
}
