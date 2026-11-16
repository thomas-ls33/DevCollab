import type { Api } from './types'
import { request } from './http'

export const restApi: Api = {
  getMe: () => request('GET', '/users/me'),
  updateMe: (data) => request('PUT', '/users/me', data),
  listUsers: (p) => request('GET', '/users', undefined, p),
  getUser: (id) => request('GET', `/users/${id}`),
  follow: (id) => request('POST', `/users/${id}/follow`),
  unfollow: (id) => request('DELETE', `/users/${id}/follow`),
  getFollowers: (id) => request('GET', `/users/${id}/followers`),
  getFollowing: (id) => request('GET', `/users/${id}/following`),

  listProjects: (p) => request('GET', '/projects', undefined, p),
  getProject: (id) => request('GET', `/projects/${id}`),
  createProject: (data) => request('POST', '/projects', data),
  updateProject: (id, data) => request('PUT', `/projects/${id}`, data),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),
  listContributions: (projectId) => request('GET', `/projects/${projectId}/contributions`),
  requestContribution: (projectId, message) => request('POST', `/projects/${projectId}/contributions`, { message }),
  updateContribution: (projectId, id, status) =>
    request('PUT', `/projects/${projectId}/contributions/${id}`, { status }),

  listPullRequests: (p) => request('GET', '/pull-requests', undefined, p),
  getPullRequest: (id) => request('GET', `/pull-requests/${id}`),
  createPullRequest: (data) => request('POST', '/pull-requests', data),
  updatePullRequest: (id, data) => request('PUT', `/pull-requests/${id}`, data),

  listReviews: (pullRequestId) => request('GET', '/reviews', undefined, { pullRequestId }),
  createReview: (data) => request('POST', '/reviews', data),

  listActivity: (p) => request('GET', '/activity', undefined, p),
}
