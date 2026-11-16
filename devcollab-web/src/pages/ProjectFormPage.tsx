import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, PageHeader, Spinner, Tags } from '../components/ui'
import { errorMessage } from '../hooks'
import { splitList } from '../format'

export function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', repoUrl: '', technologies: '' })
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .getProject(id)
      .then((p) => setForm({ name: p.name, description: p.description, repoUrl: p.repoUrl ?? '', technologies: p.technologies.join(', ') }))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      repoUrl: form.repoUrl.trim() || undefined,
      technologies: splitList(form.technologies),
    }
    try {
      const project = id ? await api.updateProject(id, payload) : await api.createProject(payload)
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="narrow">
      <PageHeader title={id ? 'Modifier le projet' : 'Nouveau projet'} />
      <form className="form card pad" onSubmit={submit}>
        <label>
          Nom du projet
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
        </label>
        <label>
          Description
          <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <label>
          URL du dépôt
          <input type="url" placeholder="https://github.com/…" value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} />
        </label>
        <label>
          Technologies
          <input placeholder="React, TypeScript, PostgreSQL" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} />
          <span className="hint">Séparées par des virgules</span>
        </label>
        <Tags items={splitList(form.technologies)} />
        {error && <ErrorBox message={error} />}
        <div className="row-end">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Enregistrement…' : id ? 'Enregistrer' : 'Créer le projet'}
          </button>
        </div>
      </form>
    </div>
  )
}
