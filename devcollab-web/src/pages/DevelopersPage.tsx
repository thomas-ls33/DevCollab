import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Avatar, Empty, ErrorBox, PageHeader, Spinner, Tag, Tags } from '../components/ui'
import { useAsync } from '../hooks'

export function DevelopersPage() {
  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const { data, error, loading, reload } = useAsync(() => api.listUsers({ q: q || undefined, skill: skill || undefined }), [q, skill])
  const all = useAsync(() => api.listUsers(), [])
  const skills = Array.from(new Set(all.data?.flatMap((u) => u.skills) ?? [])).sort()

  return (
    <>
      <PageHeader title="Développeurs" subtitle="Trouvez des collaborateurs selon leurs compétences." />
      <div className="filters">
        <input className="search" placeholder="Rechercher un développeur…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tags">
          {skills.map((s) => (
            <Tag key={s} active={skill === s} onClick={() => setSkill(skill === s ? '' : s)}>
              {s}
            </Tag>
          ))}
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : data!.length ? (
        <div className="grid">
          {data!.map((u) => (
            <Link key={u.id} to={`/developers/${u.id}`} className="card dev-card">
              <Avatar name={u.username} size={48} />
              <div className="grow">
                <strong>{u.displayName}</strong>
                <div className="muted small">@{u.username}{u.location ? ` · ${u.location}` : ''}</div>
                <p className="muted small clamp">{u.bio}</p>
                <Tags items={u.skills} />
                <div className="muted small">
                  {u.followersCount} abonné(s) · {u.followingCount} abonnement(s)
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Aucun développeur trouvé" />
      )}
    </>
  )
}
