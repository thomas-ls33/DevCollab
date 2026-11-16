import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type PullRequestStatus, type ReviewVerdict } from '../api'
import { useAuth } from '../auth/AuthContext'
import { DiffView, type DraftComment } from '../components/DiffView'
import { Avatar, Empty, ErrorBox, PageHeader, PrStatus, Spinner, Tabs, UserLink, VerdictBadge } from '../components/ui'
import { timeAgo } from '../format'
import { errorMessage, useAsync } from '../hooks'

type Tab = 'conversation' | 'files'

export function PullRequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('conversation')
  const pr = useAsync(() => api.getPullRequest(id!), [id])
  const project = useAsync(() => (pr.data ? api.getProject(pr.data.projectId) : Promise.resolve(undefined)), [pr.data?.projectId])
  const reviews = useAsync(() => api.listReviews(id!), [id])
  const [drafts, setDrafts] = useState<DraftComment[]>([])
  const [verdict, setVerdict] = useState<ReviewVerdict>('commented')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState({ title: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (pr.loading) return <Spinner />
  if (pr.error) return <ErrorBox message={pr.error} onRetry={pr.reload} />
  const p = pr.data!
  const isAuthor = p.authorId === user!.id
  const isOwner = project.data?.ownerId === user!.id
  const allComments = reviews.data?.flatMap((r) => r.comments) ?? []

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const setStatus = (status: PullRequestStatus) =>
    run(async () => {
      pr.setData(await api.updatePullRequest(p.id, { status }))
    })

  const saveEdit = () =>
    run(async () => {
      pr.setData(await api.updatePullRequest(p.id, edit))
      setEditing(false)
    })

  const submitReview = () =>
    run(async () => {
      await api.createReview({ pullRequestId: p.id, verdict, body: body.trim(), comments: drafts })
      setDrafts([])
      setBody('')
      setVerdict('commented')
      reviews.reload()
      setTab('conversation')
    })

  const reviewForm = p.status === 'open' && (
    <div className="card pad stack review-form">
      <h3>Soumettre une review</h3>
      {drafts.length > 0 && (
        <p className="muted small">
          {drafts.length} commentaire(s) de ligne en brouillon seront inclus.
        </p>
      )}
      <textarea rows={4} placeholder="Votre retour global sur cette pull request…" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="radio-group">
        {(
          [
            ['commented', 'Commenter'],
            ['approved', 'Approuver'],
            ['changes_requested', 'Demander des modifications'],
          ] as [ReviewVerdict, string][]
        ).map(([v, label]) => (
          <label key={v} className={`radio${verdict === v ? ' active' : ''}${isAuthor && v !== 'commented' ? ' disabled' : ''}`}>
            <input type="radio" name="verdict" checked={verdict === v} disabled={isAuthor && v !== 'commented'} onChange={() => setVerdict(v)} />
            {label}
          </label>
        ))}
      </div>
      <div className="row-end">
        <button className="btn primary" disabled={busy || (!body.trim() && !drafts.length)} onClick={submitReview}>
          Envoyer la review
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="breadcrumb muted small">
        <Link to={`/projects/${p.projectId}`}>{p.projectName}</Link> / Pull request
      </div>
      {editing ? (
        <div className="card pad form">
          <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <div className="row-end">
            <button className="btn ghost" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button className="btn primary" disabled={busy || !edit.title.trim()} onClick={saveEdit}>
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <PageHeader
          title={p.title}
          subtitle={
            <span className="pr-meta">
              <PrStatus status={p.status} />
              <UserLink id={p.authorId} name={p.authorName} /> veut merger <code>{p.sourceBranch}</code> dans <code>{p.targetBranch}</code> · ouverte{' '}
              {timeAgo(p.createdAt)}
            </span>
          }
          actions={
            p.status !== 'merged' && (
              <>
                {isAuthor && p.status === 'open' && (
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setEdit({ title: p.title, description: p.description })
                      setEditing(true)
                    }}
                  >
                    Modifier
                  </button>
                )}
                {(isAuthor || isOwner) && p.status === 'open' && (
                  <button className="btn ghost" disabled={busy} onClick={() => setStatus('closed')}>
                    Fermer
                  </button>
                )}
                {(isAuthor || isOwner) && p.status === 'closed' && (
                  <button className="btn ghost" disabled={busy} onClick={() => setStatus('open')}>
                    Rouvrir
                  </button>
                )}
                {isOwner && p.status === 'open' && (
                  <button className="btn success" disabled={busy} onClick={() => setStatus('merged')}>
                    Merger
                  </button>
                )}
              </>
            )
          }
        />
      )}

      {error && <ErrorBox message={error} />}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'conversation', label: 'Conversation', count: reviews.data?.length },
          { id: 'files', label: 'Fichiers modifiés', count: p.files.length },
        ]}
      />

      {tab === 'conversation' && (
        <div className="timeline">
          <div className="comment card">
            <div className="comment-head">
              <Avatar name={p.authorName} size={24} />
              <strong>{p.authorName}</strong>
              <span className="muted small">{timeAgo(p.createdAt)}</span>
            </div>
            <div className="comment-body">{p.description || <em className="muted">Aucune description.</em>}</div>
          </div>
          {reviews.loading ? (
            <Spinner />
          ) : reviews.error ? (
            <ErrorBox message={reviews.error} />
          ) : reviews.data!.length === 0 ? (
            <Empty title="Aucune review pour le moment" />
          ) : (
            reviews.data!.map((r) => (
              <div key={r.id} className={`comment card verdict-border-${r.verdict}`}>
                <div className="comment-head">
                  <Avatar name={r.reviewerName} size={24} />
                  <UserLink id={r.reviewerId} name={r.reviewerName} />
                  <VerdictBadge verdict={r.verdict} />
                  <span className="muted small">{timeAgo(r.createdAt)}</span>
                </div>
                {r.body && <div className="comment-body">{r.body}</div>}
                {r.comments.length > 0 && (
                  <ul className="line-refs">
                    {r.comments.map((c) => (
                      <li key={c.id}>
                        <button className="link-btn mono" onClick={() => setTab('files')}>
                          {c.file}:{c.line}
                        </button>{' '}
                        {c.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
          {p.status === 'merged' && <div className="alert merged">Cette pull request a été mergée.</div>}
          {p.status === 'closed' && <div className="alert">Cette pull request est fermée.</div>}
          {reviewForm}
        </div>
      )}

      {tab === 'files' && (
        <>
          {p.status === 'open' && <p className="muted small">Survolez une ligne et cliquez sur « + » pour ajouter un commentaire à votre review.</p>}
          <DiffView
            files={p.files}
            comments={allComments}
            drafts={drafts}
            onAddDraft={p.status === 'open' ? (c) => setDrafts([...drafts, c]) : undefined}
            onRemoveDraft={(i) => setDrafts(drafts.filter((_, idx) => idx !== i))}
          />
          {reviewForm}
        </>
      )}
    </>
  )
}
