import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type FileChange } from '../api'
import { DiffView } from '../components/DiffView'
import { ErrorBox, PageHeader, Spinner } from '../components/ui'
import { errorMessage, useAsync } from '../hooks'

const emptyFile = (): FileChange => ({ path: '', patch: '' })

const toPatch = (raw: string) =>
  raw.trimStart().startsWith('@@') ? raw : `@@ -0,0 +1,${raw.split('\n').length} @@\n` + raw.split('\n').map((l) => '+' + l).join('\n')

export function PullRequestFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = useAsync(() => api.getProject(id!), [id])
  const [form, setForm] = useState({ title: '', description: '', sourceBranch: '', targetBranch: 'main' })
  const [files, setFiles] = useState<FileChange[]>([emptyFile()])
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cleanFiles = files.filter((f) => f.path.trim() && f.patch.trim()).map((f) => ({ path: f.path.trim(), patch: toPatch(f.patch) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const pr = await api.createPullRequest({ projectId: id!, ...form, files: cleanFiles })
      navigate(`/pull-requests/${pr.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const updateFile = (i: number, patch: Partial<FileChange>) => setFiles(files.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  if (project.loading) return <Spinner />
  if (project.error) return <ErrorBox message={project.error} />

  return (
    <div className="narrow wide">
      <PageHeader title="Ouvrir une pull request" subtitle={`sur ${project.data!.ownerName}/${project.data!.name}`} />
      <form className="form" onSubmit={submit}>
        <div className="card pad form">
          <label>
            Titre
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />
          </label>
          <div className="row-2">
            <label>
              Branche source
              <input placeholder="feat/ma-fonctionnalite" value={form.sourceBranch} onChange={(e) => setForm({ ...form, sourceBranch: e.target.value })} required />
            </label>
            <label>
              Branche cible
              <input value={form.targetBranch} onChange={(e) => setForm({ ...form, targetBranch: e.target.value })} required />
            </label>
          </div>
          <label>
            Description
            <textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Décrivez vos changements, la motivation et comment tester…" />
          </label>
        </div>

        <div className="card pad form">
          <div className="row-between">
            <h3>Fichiers modifiés</h3>
            <button type="button" className="btn small ghost" onClick={() => setPreview(!preview)}>
              {preview ? 'Éditer' : 'Aperçu du diff'}
            </button>
          </div>
          {preview ? (
            <DiffView files={cleanFiles} comments={[]} drafts={[]} />
          ) : (
            <>
              {files.map((f, i) => (
                <div key={i} className="file-editor">
                  <div className="row-between">
                    <input placeholder="chemin/du/fichier.ts" value={f.path} onChange={(e) => updateFile(i, { path: e.target.value })} />
                    {files.length > 1 && (
                      <button type="button" className="link-btn" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                        Retirer
                      </button>
                    )}
                  </div>
                  <textarea
                    className="mono"
                    rows={8}
                    placeholder={'Collez un diff unifié (git diff) ou le contenu du nouveau fichier'}
                    value={f.patch}
                    onChange={(e) => updateFile(i, { patch: e.target.value })}
                  />
                </div>
              ))}
              <button type="button" className="btn small ghost" onClick={() => setFiles([...files, emptyFile()])}>
                + Ajouter un fichier
              </button>
            </>
          )}
        </div>

        {error && <ErrorBox message={error} />}
        <div className="row-end">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Création…' : 'Créer la pull request'}
          </button>
        </div>
      </form>
    </div>
  )
}
