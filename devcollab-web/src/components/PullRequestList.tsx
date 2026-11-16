import { Link } from 'react-router-dom'
import type { PullRequest } from '../api'
import { timeAgo } from '../format'
import { Empty, PrStatus } from './ui'

export function PullRequestList({ items, showProject = true }: { items: PullRequest[]; showProject?: boolean }) {
  if (!items.length) return <Empty title="Aucune pull request" />
  return (
    <ul className="list card">
      {items.map((pr) => (
        <li key={pr.id} className="list-row">
          <PrStatus status={pr.status} />
          <div className="grow">
            <Link to={`/pull-requests/${pr.id}`} className="row-title">
              {pr.title}
            </Link>
            <div className="muted small">
              {showProject && (
                <>
                  <Link to={`/projects/${pr.projectId}`}>{pr.projectName}</Link> ·{' '}
                </>
              )}
              par {pr.authorName} · <code>{pr.sourceBranch}</code> → <code>{pr.targetBranch}</code> · mise à jour{' '}
              {timeAgo(pr.updatedAt)}
            </div>
          </div>
          <span className="muted small">{pr.reviewsCount} review(s)</span>
        </li>
      ))}
    </ul>
  )
}
