import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { config } from '../config'
import { resetMockDb } from '../api/mockDb'
import { Avatar, Spinner } from './ui'

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">{'</>'}</span> DevCollab
    </span>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <AppLayout />
}

function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const links = [
    { to: '/', label: 'Fil d’activité', end: true },
    { to: '/projects', label: 'Projets' },
    { to: '/pull-requests', label: 'Pull requests' },
    { to: '/developers', label: 'Développeurs' },
  ]
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <Logo />
        </NavLink>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          {config.useMock && (
            <button
              className="badge demo"
              title="Réinitialiser les données de démo"
              onClick={() => {
                resetMockDb()
                window.location.reload()
              }}
            >
              Mode démo ↺
            </button>
          )}
          <NavLink to="/projects/new" className="btn small primary">
            + Nouveau projet
          </NavLink>
          <div className="user-menu">
            <NavLink to={`/developers/${user!.id}`} className="user-chip">
              <Avatar name={user!.username} size={28} />
              <span>{user!.username}</span>
            </NavLink>
            <div className="user-dropdown">
              <NavLink to={`/developers/${user!.id}`}>Mon profil</NavLink>
              <NavLink to="/settings/profile">Modifier le profil</NavLink>
              <button
                onClick={() => {
                  signOut()
                  navigate('/login')
                }}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
