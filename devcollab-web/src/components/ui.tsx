import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ContributionStatus, PullRequestStatus, ReviewVerdict } from '../api'

const palette = ['#7c5cff', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#a855f7']

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = palette[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length]
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function UserLink({ id, name }: { id: string; name: string }) {
  return (
    <Link to={`/developers/${id}`} className="user-link">
      {name}
    </Link>
  )
}

export function Tag({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <span className={`tag${onClick ? ' clickable' : ''}${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </span>
  )
}

export function Tags({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="tags">
      {items.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </div>
  )
}

const prLabels: Record<PullRequestStatus, string> = { open: 'Ouverte', closed: 'Fermée', merged: 'Mergée' }

export function PrStatus({ status }: { status: PullRequestStatus }) {
  return <span className={`badge pr-${status}`}>{prLabels[status]}</span>
}

const verdictLabels: Record<ReviewVerdict, string> = {
  approved: 'Approuvée',
  changes_requested: 'Modifications demandées',
  commented: 'Commentaire',
}

export function VerdictBadge({ verdict }: { verdict: ReviewVerdict }) {
  return <span className={`badge verdict-${verdict}`}>{verdictLabels[verdict]}</span>
}

const contribLabels: Record<ContributionStatus, string> = { pending: 'En attente', accepted: 'Acceptée', rejected: 'Refusée' }

export function ContributionBadge({ status }: { status: ContributionStatus }) {
  return <span className={`badge contrib-${status}`}>{contribLabels[status]}</span>
}

export function Spinner() {
  return (
    <div className="center">
      <span className="spinner" />
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert error">
      <span>{message}</span>
      {onRetry && (
        <button className="btn small ghost" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab${t.id === value ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
