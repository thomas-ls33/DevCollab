import { useState } from 'react'
import { api, type PullRequestStatus } from '../api'
import { useAuth } from '../auth/AuthContext'
import { PullRequestList } from '../components/PullRequestList'
import { ErrorBox, PageHeader, Spinner, Tabs } from '../components/ui'
import { useAsync } from '../hooks'

type Scope = 'all' | 'mine'

export function PullRequestsPage() {
  const { user } = useAuth()
  const [scope, setScope] = useState<Scope>('all')
  const [status, setStatus] = useState<PullRequestStatus | ''>('open')
  const { data, error, loading, reload } = useAsync(
    () => api.listPullRequests({ authorId: scope === 'mine' ? user!.id : undefined, status: status || undefined }),
    [scope, status],
  )

  return (
    <>
      <PageHeader title="Pull requests" subtitle="Suivez les contributions en cours sur l’ensemble des projets." />
      <div className="row-between">
        <Tabs<Scope>
          value={scope}
          onChange={setScope}
          tabs={[
            { id: 'all', label: 'Toutes' },
            { id: 'mine', label: 'Les miennes' },
          ]}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as PullRequestStatus | '')}>
          <option value="open">Ouvertes</option>
          <option value="merged">Mergées</option>
          <option value="closed">Fermées</option>
          <option value="">Tous statuts</option>
        </select>
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : <PullRequestList items={data!} />}
    </>
  )
}
