import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, PageHeader, Spinner, Tag } from '../components/ui'
import { errorMessage } from '../hooks'

export function ProfileEditPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ displayName: '', bio: '', location: '', githubUrl: '' })
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .getMe()
      .then((u) => {
        setUserId(u.id)
        setForm({ displayName: u.displayName, bio: u.bio, location: u.location ?? '', githubUrl: u.githubUrl ?? '' })
        setSkills(u.skills)
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s])
    setSkillInput('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.updateMe({
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        location: form.location.trim() || undefined,
        githubUrl: form.githubUrl.trim() || undefined,
        skills,
      })
      navigate(`/developers/${userId}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="narrow">
      <PageHeader title="Modifier mon profil" />
      <form className="form card pad" onSubmit={submit}>
        <label>
          Nom affiché
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        </label>
        <label>
          Bio
          <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={280} />
        </label>
        <div className="row-2">
          <label>
            Localisation
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label>
            Lien GitHub / portfolio
            <input type="url" value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} />
          </label>
        </div>
        <label>
          Compétences
          <div className="row-between">
            <input
              value={skillInput}
              placeholder="Ex. React, Docker…"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addSkill()
                }
              }}
            />
            <button type="button" className="btn ghost" onClick={addSkill}>
              Ajouter
            </button>
          </div>
        </label>
        <div className="tags">
          {skills.map((s) => (
            <Tag key={s} onClick={() => setSkills(skills.filter((x) => x !== s))}>
              {s} ✕
            </Tag>
          ))}
        </div>
        {error && <ErrorBox message={error} />}
        <div className="row-end">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}
