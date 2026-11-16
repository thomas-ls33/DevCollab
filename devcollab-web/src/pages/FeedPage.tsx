import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { ActivityFeed } from '../components/ActivityFeed'
import { Empty, ErrorBox, PageHeader, PrStatus, Spinner } from '../components/ui'
import { useAsync } from '../hooks'

export function FeedPage() {
  const { user } = useAuth()
  const feed = useAsync(() => api.listActivity(), [])
  const mine = useAsync(() => api.listProjects({ ownerId: user!.id }), [user])
  const prs = useAsync(() => api.listPullRequests({ authorId: user!.id }), [user])

  return (
    <>
      <PageHeader title={`Bonjour ${user!.username} 👋`} subtitle="Voici ce qui se passe sur DevCollab." />
      <div className="layout-2">
        <section>
          <h2 className="section-title">Fil d’activité</h2>
          {feed.loading ? <Spinner /> : feed.error ? <ErrorBox message={feed.error} onRetry={feed.reload} /> : <ActivityFeed items={feed.data!} />}
        </section>
        <aside className="stack">
          <div className="card pad">
            <div className="row-between">
              <h3>Mes projets</h3>
              <Link to="/projects/new" className="small">
                + Nouveau
              </Link>
            </div>
            {mine.loading ? (
              <Spinner />
            ) : mine.error ? (
              <ErrorBox message={mine.error} />
            ) : mine.data!.length ? (
              <ul className="mini-list">
                {mine.data!.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`}>
                      <span className="muted">{p.ownerName}/</span>
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Aucun projet">
                <Link to="/projects">Explorer les projets</Link>
              </Empty>
            )}
          </div>
          <div className="card pad">
            <h3>Mes pull requests</h3>
            {prs.loading ? (
              <Spinner />
            ) : prs.error ? (
              <ErrorBox message={prs.error} />
            ) : prs.data!.length ? (
              <ul className="mini-list">
                {prs.data!.map((pr) => (
                  <li key={pr.id}>
                    <PrStatus status={pr.status} />
                    <Link to={`/pull-requests/${pr.id}`}>{pr.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Vous n’avez ouvert aucune pull request.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
