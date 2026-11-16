import { Fragment, useState } from 'react'
import type { FileChange, LineComment } from '../api'

export interface DraftComment {
  file: string
  line: number
  body: string
}

interface Props {
  files: FileChange[]
  comments: LineComment[]
  drafts: DraftComment[]
  onAddDraft?: (c: DraftComment) => void
  onRemoveDraft?: (index: number) => void
}

interface ParsedLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk'
  text: string
  oldNo?: number
  newNo?: number
}

function parse(patch: string): ParsedLine[] {
  let oldNo = 0
  let newNo = 0
  return patch.split('\n').map((raw) => {
    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      return { kind: 'hunk', text: raw }
    }
    if (raw.startsWith('+')) return { kind: 'add', text: raw.slice(1), newNo: newNo++ }
    if (raw.startsWith('-')) return { kind: 'del', text: raw.slice(1), oldNo: oldNo++ }
    return { kind: 'ctx', text: raw.startsWith(' ') ? raw.slice(1) : raw, oldNo: oldNo++, newNo: newNo++ }
  })
}

export function DiffView({ files, comments, drafts, onAddDraft, onRemoveDraft }: Props) {
  const [editing, setEditing] = useState<{ file: string; line: number } | null>(null)
  const [text, setText] = useState('')

  const submit = () => {
    if (!editing || !text.trim() || !onAddDraft) return
    onAddDraft({ ...editing, body: text.trim() })
    setEditing(null)
    setText('')
  }

  if (!files.length) return <p className="muted">Aucun fichier modifié.</p>

  return (
    <div className="diff-files">
      {files.map((f) => {
        const lines = parse(f.patch)
        const adds = lines.filter((l) => l.kind === 'add').length
        const dels = lines.filter((l) => l.kind === 'del').length
        return (
          <div key={f.path} className="diff-file card">
            <div className="diff-file-head">
              <code>{f.path}</code>
              <span className="small">
                <span className="plus">+{adds}</span> <span className="minus">−{dels}</span>
              </span>
            </div>
            <table className="diff">
              <tbody>
                {lines.map((l, i) => {
                  const lineNo = l.newNo ?? l.oldNo
                  const lineComments = comments.filter((c) => c.file === f.path && c.line === lineNo && l.kind !== 'hunk')
                  const lineDrafts = drafts
                    .map((d, idx) => ({ ...d, idx }))
                    .filter((d) => d.file === f.path && d.line === lineNo && l.kind !== 'hunk')
                  const isEditing = editing?.file === f.path && editing.line === lineNo && l.kind !== 'hunk'
                  return (
                    <Fragment key={i}>
                      <tr className={`dl ${l.kind}`}>
                        <td className="ln">{l.oldNo ?? ''}</td>
                        <td className="ln">{l.newNo ?? ''}</td>
                        <td className="code">
                          {onAddDraft && l.kind !== 'hunk' && lineNo !== undefined && (
                            <button
                              className="add-comment"
                              title="Commenter cette ligne"
                              onClick={() => {
                                setEditing({ file: f.path, line: lineNo })
                                setText('')
                              }}
                            >
                              +
                            </button>
                          )}
                          <span className="sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}</span>
                          {l.text}
                        </td>
                      </tr>
                      {(lineComments.length > 0 || lineDrafts.length > 0 || isEditing) && (
                        <tr className="dl-comments">
                          <td colSpan={3}>
                            {lineComments.map((c) => (
                              <div key={c.id} className="line-comment">
                                <strong>{c.authorName}</strong> {c.body}
                              </div>
                            ))}
                            {lineDrafts.map((d) => (
                              <div key={d.idx} className="line-comment draft">
                                <span className="badge contrib-pending">Brouillon</span> {d.body}
                                {onRemoveDraft && (
                                  <button className="link-btn" onClick={() => onRemoveDraft(d.idx)}>
                                    Retirer
                                  </button>
                                )}
                              </div>
                            ))}
                            {isEditing && (
                              <div className="line-editor">
                                <textarea
                                  autoFocus
                                  rows={3}
                                  value={text}
                                  onChange={(e) => setText(e.target.value)}
                                  placeholder="Votre commentaire sur cette ligne…"
                                />
                                <div className="row-end">
                                  <button className="btn small ghost" onClick={() => setEditing(null)}>
                                    Annuler
                                  </button>
                                  <button className="btn small primary" onClick={submit} disabled={!text.trim()}>
                                    Ajouter à la review
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
