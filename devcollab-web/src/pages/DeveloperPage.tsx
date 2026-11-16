import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type User } from '../api'
import { useAuth } from '../auth/AuthContext'
import { ActivityFeed } from '../components/ActivityFeed'
import { ProjectCard } from '../components/ProjectCard'
import { PullRequestList } from '../components/PullRequestList'
import { Avatar, Empty, ErrorBox, Spinner, Tabs, Tags } from '../components/ui'
import { formatDate } from '../format'
import { errorMessage, useAsync } from '../hooks'

type Tab = 'activity' | 'projects' | 'prs' | 'followers' | 'following'

function UserGrid({ users }: { users: User[] }) {
  if (!users.length) return <Empty title="Personne pour le moment" />
  return (
    <ul className="list card">
      {users.map((u) => (
        <li key={u.id} className="list-row">
          <Avatar name={u.username} />
          <div className="grow">
            <Link to={`/developers/${u.id}`} className="row-title">
              {u.displayName}
            </Link>
            <div className="muted small">@{u.username}</div>
          </div>
          <Tags items={u.skills.slice(0, 3)} />
        </li>
      ))}
    </ul>
  )
}

export function DeveloperPage() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const [tab, setTab] = useState<Tab>('activity')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const profile = useAsync(() => api.getUser(id!), [id])
  const activity = useAsync(() => api.listActivity({ userId: id }), [id])
  const projects = useAsync(() => api.listProjects({ ownerId: id }), [id])
  const prs = useAsync(() => api.listPullRequests({ authorId: id }), [id])
  const followers = useAsync(() => api.getFollowers(id!), [id])
  const following = useAsync(() => api.getFollowing(id!), [id])

  if (profile.loading) return <Spinner />
  if (profile.error) return <ErrorBox message={profile.error} onRetry={profile.reload} />
  const u = profile.data!
  const isMe = u.id === me!.id

  const toggleFollow = async () => {
    setBusy(true)
    setError(null)
    try {
      if (u.isFollowing) await api.unfollow(u.id)
      else await api.follow(u.id)
      profile.reload()
      followers.reload()
      activity.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-layout">
      <aside className="profile-side">
        <Avatar name={u.username} size={120} />
        <h1>{u.displayName}</h1>
        <div className="muted">@{u.username}</div>
        {u.bio && <p>{u.bio}</p>}
        {isMe ? (
          <Link to="/settings/profile" className="btn ghost block">
            Modifier le profil
          </Link>
        ) : (
          <button className={`btn block ${u.isFollowing ? 'ghost' : 'primary'}`} disabled={busy} onClick={toggleFollow}>
            {u.isFollowing ? 'Ne plus suivre' : 'Suivre'}
          </button>
        )}
        {error && <ErrorBox message={error} />}
        <div className="muted small">
          <button className="link-btn" onClick={() => setTab('followers')}>
            <strong>{u.followersCount}</strong> abonné(s)
          </button>{' '}
          ·{' '}
          <button className="link-btn" onClick={() => setTab('following')}>
            <strong>{u.followingCount}</strong> abonnement(s)
          </button>
        </div>
        <ul className="profile-facts muted small">
          {u.location && <li>📍 {u.location}</li>}
          {u.githubUrl && (
            <li>
              🔗{' '}
              <a href={u.githubUrl} target="_blank" rel="noreferrer">
                {u.githubUrl.replace(/^https?:\/\//, '')}
              </a>
            </li>
          )}
          <li>🗓 Membre depuis le {formatDate(u.createdAt)}</li>
        </ul>
        {u.skills.length > 0 && (
          <div>
            <h3>Compétences</h3>
            <Tags items={u.skills} />
          </div>
        )}
      </aside>
      <section>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'activity', label: 'Activité' },
            { id: 'projects', label: 'Projets', count: projects.data?.length },
            { id: 'prs', label: 'Pull requests', count: prs.data?.length },
            { id: 'followers', label: 'Abonnés', count: followers.data?.length },
            { id: 'following', label: 'Abonnements', count: following.data?.length },
          ]}
        />
        {tab === 'activity' && (activity.loading ? <Spinner /> : activity.error ? <ErrorBox message={activity.error} /> : <ActivityFeed items={activity.data!} />)}
        {tab === 'projects' &&
          (projects.loading ? (
            <Spinner />
          ) : projects.error ? (
            <ErrorBox message={projects.error} />
          ) : projects.data!.length ? (
            <div className="grid">
              {projects.data!.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <Empty title="Aucun projet" />
          ))}
        {tab === 'prs' && (prs.loading ? <Spinner /> : prs.error ? <ErrorBox message={prs.error} /> : <PullRequestList items={prs.data!} />)}
        {tab === 'followers' && (followers.loading ? <Spinner /> : followers.error ? <ErrorBox message={followers.error} /> : <UserGrid users={followers.data!} />)}
        {tab === 'following' && (following.loading ? <Spinner /> : following.error ? <ErrorBox message={following.error} /> : <UserGrid users={following.data!} />)}
      </section>
    </div>
  )
}
