import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type ContributionRequest, type ContributionStatus, type PullRequestStatus } from '../api'
import { useAuth } from '../auth/AuthContext'
import { ActivityFeed } from '../components/ActivityFeed'
import { PullRequestList } from '../components/PullRequestList'
import { Avatar, ContributionBadge, Empty, ErrorBox, PageHeader, Spinner, Tabs, Tags, UserLink } from '../components/ui'
import { formatDate, timeAgo } from '../format'
import { errorMessage, useAsync } from '../hooks'

type Tab = 'overview' | 'prs' | 'contributions' | 'activity'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [prFilter, setPrFilter] = useState<PullRequestStatus | ''>('open')
  const project = useAsync(() => api.getProject(id!), [id])
  const prs = useAsync(() => api.listPullRequests({ projectId: id }), [id])
  const contributions = useAsync(() => api.listContributions(id!), [id])
  const activity = useAsync(() => api.listActivity({ projectId: id }), [id])

  if (project.loading) return <Spinner />
  if (project.error) return <ErrorBox message={project.error} onRetry={project.reload} />
  const p = project.data!
  const isOwner = p.ownerId === user!.id
  const isMember = isOwner || p.contributors.some((c) => c.id === user!.id)
  const pending = contributions.data?.find((c) => c.userId === user!.id && c.status === 'pending')
  const filteredPrs = (prs.data ?? []).filter((pr) => !prFilter || pr.status === prFilter)

  const remove = async () => {
    if (!confirm(`Supprimer définitivement le projet « ${p.name} » ?`)) return
    try {
      await api.deleteProject(p.id)
      navigate('/projects')
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="muted">{p.ownerName} /</span> {p.name}
          </>
        }
        subtitle={<>Créé le {formatDate(p.createdAt)}</>}
        actions={
          <>
            {isMember && (
              <Link to={`/projects/${p.id}/pull-requests/new`} className="btn primary">
                Ouvrir une pull request
              </Link>
            )}
            {isOwner && (
              <>
                <Link to={`/projects/${p.id}/edit`} className="btn ghost">
                  Modifier
                </Link>
                <button className="btn danger" onClick={remove}>
                  Supprimer
                </button>
              </>
            )}
          </>
        }
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Aperçu' },
          { id: 'prs', label: 'Pull requests', count: prs.data?.filter((x) => x.status === 'open').length },
          { id: 'contributions', label: 'Contributions', count: contributions.data?.filter((c) => c.status === 'pending').length },
          { id: 'activity', label: 'Activité' },
        ]}
      />

      {tab === 'overview' && (
        <div className="layout-2">
          <div className="card pad stack">
            <h3>À propos</h3>
            <p>{p.description}</p>
            <Tags items={p.technologies} />
            {p.repoUrl && (
              <a href={p.repoUrl} target="_blank" rel="noreferrer">
                {p.repoUrl}
              </a>
            )}
          </div>
          <aside className="stack">
            <div className="card pad">
              <h3>Membres</h3>
              <ul className="people">
                <li>
                  <Avatar name={p.ownerName} size={28} />
                  <UserLink id={p.ownerId} name={p.ownerName} />
                  <span className="badge">Propriétaire</span>
                </li>
                {p.contributors.map((c) => (
                  <li key={c.id}>
                    <Avatar name={c.username} size={28} />
                    <UserLink id={c.id} name={c.username} />
                  </li>
                ))}
              </ul>
            </div>
            {!isMember && <ContributeBox projectId={p.id} pending={pending} onDone={() => contributions.reload()} />}
          </aside>
        </div>
      )}

      {tab === 'prs' && (
        <>
          <div className="filters">
            <select value={prFilter} onChange={(e) => setPrFilter(e.target.value as PullRequestStatus | '')}>
              <option value="open">Ouvertes</option>
              <option value="merged">Mergées</option>
              <option value="closed">Fermées</option>
              <option value="">Toutes</option>
            </select>
          </div>
          {prs.loading ? <Spinner /> : prs.error ? <ErrorBox message={prs.error} /> : <PullRequestList items={filteredPrs} showProject={false} />}
        </>
      )}

      {tab === 'contributions' && (
        <ContributionsTab
          projectId={p.id}
          isOwner={isOwner}
          items={contributions.data}
          loading={contributions.loading}
          error={contributions.error}
          onChange={() => {
            contributions.reload()
            project.reload()
          }}
        />
      )}

      {tab === 'activity' &&
        (activity.loading ? <Spinner /> : activity.error ? <ErrorBox message={activity.error} /> : <ActivityFeed items={activity.data!} />)}
    </>
  )
}

function ContributeBox({ projectId, pending, onDone }: { projectId: string; pending?: ContributionRequest; onDone: () => void }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (pending)
    return (
      <div className="card pad">
        <h3>Votre demande</h3>
        <p className="muted small">Envoyée {timeAgo(pending.createdAt)}</p>
        <ContributionBadge status="pending" />
      </div>
    )

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.requestContribution(projectId, message.trim())
      setMessage('')
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card pad stack">
      <h3>Contribuer à ce projet</h3>
      <textarea rows={3} placeholder="Présentez-vous et expliquez ce que vous aimeriez apporter…" value={message} onChange={(e) => setMessage(e.target.value)} />
      {error && <ErrorBox message={error} />}
      <button className="btn primary" disabled={busy || !message.trim()} onClick={submit}>
        {busy ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </div>
  )
}

function ContributionsTab({
  projectId,
  isOwner,
  items,
  loading,
  error,
  onChange,
}: {
  projectId: string
  isOwner: boolean
  items?: ContributionRequest[]
  loading: boolean
  error: string | null
  onChange: () => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} />
  if (!items?.length) return <Empty title="Aucune demande de contribution" />

  const act = async (id: string, status: ContributionStatus) => {
    setActionError(null)
    try {
      await api.updateContribution(projectId, id, status)
      onChange()
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <>
      {actionError && <ErrorBox message={actionError} />}
      <ul className="list card">
        {items.map((c) => (
          <li key={c.id} className="list-row">
            <Avatar name={c.username} />
            <div className="grow">
              <div>
                <UserLink id={c.userId} name={c.username} /> <span className="muted small">· {timeAgo(c.createdAt)}</span>
              </div>
              <p className="muted">{c.message}</p>
            </div>
            {isOwner && c.status === 'pending' ? (
              <div className="actions">
                <button className="btn small success" onClick={() => act(c.id, 'accepted')}>
                  Accepter
                </button>
                <button className="btn small ghost" onClick={() => act(c.id, 'rejected')}>
                  Refuser
                </button>
              </div>
            ) : (
              <ContributionBadge status={c.status} />
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
