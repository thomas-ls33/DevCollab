import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ProjectCard } from '../components/ProjectCard'
import { Empty, ErrorBox, PageHeader, Spinner, Tag } from '../components/ui'
import { useAsync } from '../hooks'

export function ProjectsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tech = params.get('tech') ?? ''
  const [search, setSearch] = useState(q)
  const { data, error, loading, reload } = useAsync(() => api.listProjects({ q, tech }), [q, tech])
  const all = useAsync(() => api.listProjects(), [])
  const techs = Array.from(new Set(all.data?.flatMap((p) => p.technologies) ?? [])).sort()

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) setParams((p) => (search ? p.set('q', search) : p.delete('q'), p), { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const toggleTech = (t: string) => setParams((p) => (tech === t ? p.delete('tech') : p.set('tech', t), p))

  return (
    <>
      <PageHeader
        title="Projets open source"
        subtitle="Découvrez des projets et proposez votre contribution."
        actions={
          <Link to="/projects/new" className="btn primary">
            + Nouveau projet
          </Link>
        }
      />
      <div className="filters">
        <input className="search" placeholder="Rechercher un projet…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tags">
          {techs.map((t) => (
            <Tag key={t} onClick={() => toggleTech(t)} active={tech === t}>
              {t}
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
          {data!.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty title="Aucun projet ne correspond à votre recherche" />
      )}
    </>
  )
}
