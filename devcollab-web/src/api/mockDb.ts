import type { Activity, ActivityType, ContributionRequest, FileChange, LineComment, PullRequestStatus, ReviewVerdict } from './types'

export interface Account {
  id: string
  username: string
  email: string
  password: string
  confirmed: boolean
}

export interface Profile {
  displayName: string
  bio: string
  location?: string
  githubUrl?: string
  skills: string[]
  createdAt: string
}

export interface ProjectRow {
  id: string
  name: string
  description: string
  repoUrl?: string
  technologies: string[]
  ownerId: string
  contributorIds: string[]
  createdAt: string
}

export interface PullRequestRow {
  id: string
  projectId: string
  authorId: string
  title: string
  description: string
  sourceBranch: string
  targetBranch: string
  status: PullRequestStatus
  files: FileChange[]
  createdAt: string
  updatedAt: string
}

export interface ReviewRow {
  id: string
  pullRequestId: string
  reviewerId: string
  verdict: ReviewVerdict
  body: string
  comments: LineComment[]
  createdAt: string
}

interface Store {
  accounts: Account[]
  profiles: Record<string, Profile>
  follows: { from: string; to: string }[]
  projects: ProjectRow[]
  contributions: ContributionRequest[]
  pullRequests: PullRequestRow[]
  reviews: ReviewRow[]
  activity: Activity[]
}

const KEY = 'devcollab.mock.db.v1'

export const uid = () => Math.random().toString(36).slice(2, 10)

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()

function seed(): Store {
  const accounts: Account[] = [
    { id: 'u-demo', username: 'demo', email: 'demo@devcollab.dev', password: 'demo1234', confirmed: true },
    { id: 'u-alice', username: 'alice', email: 'alice@devcollab.dev', password: 'alice1234', confirmed: true },
    { id: 'u-bob', username: 'bob', email: 'bob@devcollab.dev', password: 'bob12345', confirmed: true },
    { id: 'u-chloe', username: 'chloe', email: 'chloe@devcollab.dev', password: 'chloe1234', confirmed: true },
    { id: 'u-karim', username: 'karim', email: 'karim@devcollab.dev', password: 'karim1234', confirmed: true },
  ]
  const profiles: Record<string, Profile> = {
    'u-demo': { displayName: 'Compte Démo', bio: 'Développeur full-stack curieux, contributeur du dimanche.', location: 'Bordeaux', skills: ['TypeScript', 'React', 'Python'], createdAt: ago(900) },
    'u-alice': { displayName: 'Alice Martin', bio: 'Mainteneuse de petits outils CLI. Rust addict.', location: 'Lyon', githubUrl: 'https://github.com/', skills: ['Rust', 'Go', 'Linux'], createdAt: ago(2000) },
    'u-bob': { displayName: 'Bob Durand', bio: 'Backend & bases de données. PostgreSQL ou rien.', location: 'Nantes', skills: ['Python', 'PostgreSQL', 'Docker', 'AWS'], createdAt: ago(1500) },
    'u-chloe': { displayName: 'Chloé Bernard', bio: 'Front-end, accessibilité et design systems.', location: 'Paris', skills: ['React', 'TypeScript', 'CSS', 'Figma'], createdAt: ago(1200) },
    'u-karim': { displayName: 'Karim Haddad', bio: 'DevOps, CI/CD, serverless.', location: 'Toulouse', skills: ['AWS', 'Terraform', 'Go', 'Docker'], createdAt: ago(700) },
  }
  const projects: ProjectRow[] = [
    { id: 'p-meteo', name: 'meteo-cli', description: 'Une CLI rapide pour consulter la météo depuis le terminal, avec cache local et sortie colorée.', repoUrl: 'https://github.com/', technologies: ['Rust', 'CLI'], ownerId: 'u-alice', contributorIds: ['u-karim'], createdAt: ago(600) },
    { id: 'p-kanban', name: 'kanban-lite', description: 'Tableau Kanban minimaliste en React, drag & drop accessible et persistance locale.', repoUrl: 'https://github.com/', technologies: ['React', 'TypeScript', 'CSS'], ownerId: 'u-chloe', contributorIds: ['u-demo'], createdAt: ago(400) },
    { id: 'p-pgmig', name: 'pg-migrate-lite', description: 'Outil de migrations PostgreSQL ultra-léger, fichiers SQL versionnés et rollback.', technologies: ['Python', 'PostgreSQL'], ownerId: 'u-bob', contributorIds: [], createdAt: ago(300) },
    { id: 'p-lambda', name: 'lambda-starter', description: 'Template serverless AWS (API Gateway + Lambda + Cognito) prêt à déployer.', technologies: ['AWS', 'Python', 'Terraform'], ownerId: 'u-karim', contributorIds: ['u-bob'], createdAt: ago(150) },
  ]
  const pullRequests: PullRequestRow[] = [
    {
      id: 'pr-1', projectId: 'p-kanban', authorId: 'u-demo', title: 'Ajout du raccourci clavier pour déplacer une carte', description: 'Permet de déplacer la carte sélectionnée avec Alt + flèches, pour améliorer l’accessibilité.', sourceBranch: 'feat/keyboard-move', targetBranch: 'main', status: 'open',
      files: [{ path: 'src/hooks/useKeyboardMove.ts', patch: '@@ -0,0 +1,14 @@\n+import { useEffect } from \'react\'\n+\n+export function useKeyboardMove(onMove: (dir: number) => void) {\n+  useEffect(() => {\n+    const handler = (e: KeyboardEvent) => {\n+      if (!e.altKey) return\n+      if (e.key === \'ArrowLeft\') onMove(-1)\n+      if (e.key === \'ArrowRight\') onMove(1)\n+    }\n+    window.addEventListener(\'keydown\', handler)\n+    return () => window.removeEventListener(\'keydown\', handler)\n+  }, [onMove])\n+}' },
        { path: 'src/components/Board.tsx', patch: '@@ -12,6 +12,8 @@\n import { Column } from \'./Column\'\n+import { useKeyboardMove } from \'../hooks/useKeyboardMove\'\n \n export function Board() {\n   const [cards, setCards] = useCards()\n+  useKeyboardMove((dir) => moveSelected(dir))\n   return (' }],
      createdAt: ago(30), updatedAt: ago(5),
    },
    {
      id: 'pr-2', projectId: 'p-meteo', authorId: 'u-karim', title: 'CI : build multi-plateforme avec GitHub Actions', description: 'Ajoute un workflow qui compile pour Linux, macOS et Windows à chaque tag.', sourceBranch: 'ci/release', targetBranch: 'main', status: 'merged',
      files: [{ path: '.github/workflows/release.yml', patch: '@@ -0,0 +1,9 @@\n+name: release\n+on:\n+  push:\n+    tags: [\'v*\']\n+jobs:\n+  build:\n+    strategy:\n+      matrix: { os: [ubuntu-latest, macos-latest, windows-latest] }\n+    runs-on: ${{ matrix.os }}' }],
      createdAt: ago(120), updatedAt: ago(90),
    },
    {
      id: 'pr-3', projectId: 'p-lambda', authorId: 'u-bob', title: 'Pool de connexions PostgreSQL réutilisé entre invocations', description: 'Déplace la connexion hors du handler pour profiter du warm start Lambda.', sourceBranch: 'perf/db-pool', targetBranch: 'main', status: 'open',
      files: [{ path: 'src/db.py', patch: '@@ -1,8 +1,12 @@\n import os\n import psycopg\n \n-def handler(event, context):\n-    conn = psycopg.connect(os.environ["DB_HOST"])\n+_conn = None\n+\n+def get_conn():\n+    global _conn\n+    if _conn is None or _conn.closed:\n+        _conn = psycopg.connect(host=os.environ["DB_HOST"])\n+    return _conn' }],
      createdAt: ago(20), updatedAt: ago(20),
    },
  ]
  const reviews: ReviewRow[] = [
    { id: 'r-1', pullRequestId: 'pr-1', reviewerId: 'u-chloe', verdict: 'changes_requested', body: 'Super idée ! Il faudrait gérer aussi les flèches haut/bas pour réordonner dans une colonne.', comments: [{ id: 'lc-1', file: 'src/hooks/useKeyboardMove.ts', line: 8, body: 'Ajouter ArrowUp / ArrowDown ici ?', authorId: 'u-chloe', authorName: 'chloe', createdAt: ago(10) }], createdAt: ago(10) },
    { id: 'r-2', pullRequestId: 'pr-2', reviewerId: 'u-alice', verdict: 'approved', body: 'Parfait, merci !', comments: [], createdAt: ago(95) },
  ]
  const contributions: ContributionRequest[] = [
    { id: 'c-1', projectId: 'p-pgmig', userId: 'u-karim', username: 'karim', message: 'Je peux ajouter une image Docker et une CI.', status: 'pending', createdAt: ago(40) },
    { id: 'c-2', projectId: 'p-kanban', userId: 'u-demo', username: 'demo', message: 'J’aimerais travailler sur l’accessibilité clavier.', status: 'accepted', createdAt: ago(200) },
  ]
  const a = (type: ActivityType, actorId: string, h: number, extra: Partial<Activity> = {}): Activity => ({
    id: uid(), type, actorId, actorName: accounts.find((x) => x.id === actorId)!.username, createdAt: ago(h), ...extra,
  })
  const activity: Activity[] = [
    a('review_submitted', 'u-chloe', 10, { projectId: 'p-kanban', projectName: 'kanban-lite', targetId: 'pr-1', targetLabel: 'Ajout du raccourci clavier pour déplacer une carte' }),
    a('pr_opened', 'u-bob', 20, { projectId: 'p-lambda', projectName: 'lambda-starter', targetId: 'pr-3', targetLabel: 'Pool de connexions PostgreSQL réutilisé entre invocations' }),
    a('pr_opened', 'u-demo', 30, { projectId: 'p-kanban', projectName: 'kanban-lite', targetId: 'pr-1', targetLabel: 'Ajout du raccourci clavier pour déplacer une carte' }),
    a('contribution_requested', 'u-karim', 40, { projectId: 'p-pgmig', projectName: 'pg-migrate-lite' }),
    a('pr_merged', 'u-alice', 90, { projectId: 'p-meteo', projectName: 'meteo-cli', targetId: 'pr-2', targetLabel: 'CI : build multi-plateforme avec GitHub Actions' }),
    a('project_created', 'u-karim', 150, { projectId: 'p-lambda', projectName: 'lambda-starter' }),
    a('user_followed', 'u-bob', 180, { targetId: 'u-alice', targetLabel: 'alice' }),
    a('contribution_accepted', 'u-chloe', 190, { projectId: 'p-kanban', projectName: 'kanban-lite', targetId: 'u-demo', targetLabel: 'demo' }),
  ]
  return {
    accounts,
    profiles,
    follows: [
      { from: 'u-demo', to: 'u-chloe' },
      { from: 'u-bob', to: 'u-alice' },
      { from: 'u-karim', to: 'u-alice' },
      { from: 'u-chloe', to: 'u-demo' },
      { from: 'u-alice', to: 'u-karim' },
    ],
    projects,
    contributions,
    pullRequests,
    reviews,
    activity,
  }
}

let cache: Store | null = null

export function db(): Store {
  if (!cache) {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Store) : seed()
  }
  return cache
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(db()))
}

export function resetMockDb() {
  cache = seed()
  save()
}

export const mockDb = {
  accounts: () => db().accounts,
  createAccount(username: string, email: string, password: string) {
    const id = 'u-' + uid()
    db().accounts.push({ id, username, email, password, confirmed: false })
    db().profiles[id] = { displayName: username, bio: '', skills: [], createdAt: new Date().toISOString() }
    save()
  },
  confirmAccount(username: string) {
    const acc = db().accounts.find((a) => a.username === username)
    if (!acc) throw new Error('Utilisateur introuvable.')
    acc.confirmed = true
    save()
  },
}
