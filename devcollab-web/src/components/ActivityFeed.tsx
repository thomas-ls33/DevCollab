import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Activity } from '../api'
import { timeAgo } from '../format'
import { Avatar, Empty, UserLink } from './ui'

const icons: Record<Activity['type'], string> = {
  project_created: '✦',
  contribution_requested: '✋',
  contribution_accepted: '✓',
  pr_opened: '⇡',
  pr_merged: '⑂',
  pr_closed: '✕',
  review_submitted: '◉',
  user_followed: '★',
}

function describe(a: Activity): ReactNode {
  const project = a.projectId ? <Link to={`/projects/${a.projectId}`}>{a.projectName}</Link> : null
  const pr = a.targetId ? <Link to={`/pull-requests/${a.targetId}`}>{a.targetLabel}</Link> : null
  const user = a.targetId ? <UserLink id={a.targetId} name={a.targetLabel ?? ''} /> : null
  switch (a.type) {
    case 'project_created':
      return <>a créé le projet {project}</>
    case 'contribution_requested':
      return <>souhaite contribuer à {project}</>
    case 'contribution_accepted':
      return <>a accepté {user} comme contributeur de {project}</>
    case 'pr_opened':
      return <>a ouvert la pull request {pr} sur {project}</>
    case 'pr_merged':
      return <>a mergé {pr} dans {project}</>
    case 'pr_closed':
      return <>a fermé {pr} sur {project}</>
    case 'review_submitted':
      return <>a reviewé {pr} sur {project}</>
    case 'user_followed':
      return <>suit désormais {user}</>
  }
}

export function ActivityFeed({ items }: { items: Activity[] }) {
  if (!items.length) return <Empty title="Aucune activité pour le moment" />
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id} className="feed-item">
          <span className={`feed-icon t-${a.type}`}>{icons[a.type]}</span>
          <Avatar name={a.actorName} size={28} />
          <div className="feed-body">
            <div>
              <UserLink id={a.actorId} name={a.actorName} /> {describe(a)}
            </div>
            <time className="muted small">{timeAgo(a.createdAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  )
}
