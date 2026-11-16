import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { auth } from '../auth'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Layout'
import { config } from '../config'
import { errorMessage } from '../hooks'

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Logo />
        <h2>Collaborez sur des projets open source.</h2>
        <p>Trouvez des projets, proposez vos contributions, ouvrez des pull requests et faites des reviews de code avec la communauté.</p>
      </div>
      <div className="auth-card card">
        <h1>{title}</h1>
        {children}
        <div className="auth-footer muted">{footer}</div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState(config.useMock ? 'demo' : '')
  const [password, setPassword] = useState(config.useMock ? 'demo1234' : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username.trim(), password)
      navigate((location.state as { from?: string })?.from ?? '/', { replace: true })
    } catch (err) {
      if ((err as { code?: string }).code === 'UserNotConfirmedException') {
        navigate(`/confirm?username=${encodeURIComponent(username.trim())}`)
        return
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Connexion"
      footer={
        <>
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </>
      }
    >
      {config.useMock && (
        <div className="alert info">
          Mode démo : compte <code>demo</code> / <code>demo1234</code>
        </div>
      )}
      <form onSubmit={submit} className="form">
        <label>
          Nom d’utilisateur ou e-mail
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas.')
    setBusy(true)
    setError(null)
    try {
      await auth.signUp(form.username.trim(), form.email.trim(), form.password)
      navigate(`/confirm?username=${encodeURIComponent(form.username.trim())}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Créer un compte"
      footer={
        <>
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </>
      }
    >
      <form onSubmit={submit} className="form">
        <label>
          Nom d’utilisateur
          <input value={form.username} onChange={set('username')} required pattern="[a-zA-Z0-9_\-]{3,30}" title="3 à 30 caractères alphanumériques" />
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} />
          <span className="hint">8 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial selon la politique Cognito.</span>
        </label>
        <label>
          Confirmer le mot de passe
          <input type="password" value={form.confirm} onChange={set('confirm')} required />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthShell>
  )
}

export function ConfirmPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState(params.get('username') ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.confirm(username.trim(), code.trim())
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await auth.resendCode(username.trim())
      setInfo('Un nouveau code a été envoyé par e-mail.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <AuthShell title="Confirmer votre compte" footer={<Link to="/login">Retour à la connexion</Link>}>
      <p className="muted">Saisissez le code de vérification reçu par e-mail.</p>
      {config.useMock && <div className="alert info">Mode démo : le code est <code>123456</code></div>}
      <form onSubmit={submit} className="form">
        <label>
          Nom d’utilisateur
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Code de vérification
          <input value={code} onChange={(e) => setCode(e.target.value)} required inputMode="numeric" autoFocus />
        </label>
        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert info">{info}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Vérification…' : 'Confirmer'}
        </button>
        <button type="button" className="btn ghost block" onClick={resend} disabled={!username}>
          Renvoyer le code
        </button>
      </form>
    </AuthShell>
  )
}
