export interface User {
  id: string
  username: string
  email: string
  displayName: string
  bio: string
  location?: string
  githubUrl?: string
  skills: string[]
  followersCount: number
  followingCount: number
  isFollowing?: boolean
  createdAt: string
}

export interface UserUpdate {
  displayName: string
  bio: string
  location?: string
  githubUrl?: string
  skills: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  repoUrl?: string
  technologies: string[]
  ownerId: string
  ownerName: string
  contributors: { id: string; username: string }[]
  openPullRequests: number
  createdAt: string
}

export interface ProjectInput {
  name: string
  description: string
  repoUrl?: string
  technologies: string[]
}

export type ContributionStatus = 'pending' | 'accepted' | 'rejected'

export interface ContributionRequest {
  id: string
  projectId: string
  userId: string
  username: string
  message: string
  status: ContributionStatus
  createdAt: string
}

export type PullRequestStatus = 'open' | 'closed' | 'merged'

export interface FileChange {
  path: string
  patch: string
}

export interface PullRequest {
  id: string
  projectId: string
  projectName: string
  authorId: string
  authorName: string
  title: string
  description: string
  sourceBranch: string
  targetBranch: string
  status: PullRequestStatus
  files: FileChange[]
  reviewsCount: number
  createdAt: string
  updatedAt: string
}

export interface PullRequestInput {
  projectId: string
  title: string
  description: string
  sourceBranch: string
  targetBranch: string
  files: FileChange[]
}

export interface PullRequestUpdate {
  title?: string
  description?: string
  status?: PullRequestStatus
}

export type ReviewVerdict = 'approved' | 'changes_requested' | 'commented'

export interface LineComment {
  id: string
  file: string
  line: number
  body: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface Review {
  id: string
  pullRequestId: string
  reviewerId: string
  reviewerName: string
  verdict: ReviewVerdict
  body: string
  comments: LineComment[]
  createdAt: string
}

export interface ReviewInput {
  pullRequestId: string
  verdict: ReviewVerdict
  body: string
  comments: { file: string; line: number; body: string }[]
}

export type ActivityType =
  | 'project_created'
  | 'contribution_requested'
  | 'contribution_accepted'
  | 'pr_opened'
  | 'pr_merged'
  | 'pr_closed'
  | 'review_submitted'
  | 'user_followed'

export interface Activity {
  id: string
  type: ActivityType
  actorId: string
  actorName: string
  projectId?: string
  projectName?: string
  targetId?: string
  targetLabel?: string
  createdAt: string
}

export interface Api {
  getMe(): Promise<User>
  updateMe(data: UserUpdate): Promise<User>
  listUsers(params?: { q?: string; skill?: string }): Promise<User[]>
  getUser(id: string): Promise<User>
  follow(id: string): Promise<void>
  unfollow(id: string): Promise<void>
  getFollowers(id: string): Promise<User[]>
  getFollowing(id: string): Promise<User[]>

  listProjects(params?: { q?: string; tech?: string; ownerId?: string }): Promise<Project[]>
  getProject(id: string): Promise<Project>
  createProject(data: ProjectInput): Promise<Project>
  updateProject(id: string, data: ProjectInput): Promise<Project>
  deleteProject(id: string): Promise<void>
  listContributions(projectId: string): Promise<ContributionRequest[]>
  requestContribution(projectId: string, message: string): Promise<ContributionRequest>
  updateContribution(projectId: string, id: string, status: ContributionStatus): Promise<ContributionRequest>

  listPullRequests(params?: { projectId?: string; authorId?: string; status?: PullRequestStatus }): Promise<PullRequest[]>
  getPullRequest(id: string): Promise<PullRequest>
  createPullRequest(data: PullRequestInput): Promise<PullRequest>
  updatePullRequest(id: string, data: PullRequestUpdate): Promise<PullRequest>

  listReviews(pullRequestId: string): Promise<Review[]>
  createReview(data: ReviewInput): Promise<Review>

  listActivity(params?: { userId?: string; projectId?: string }): Promise<Activity[]>
}
