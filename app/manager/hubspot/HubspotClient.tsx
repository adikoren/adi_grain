'use client'

export default function HubspotClient({ syncLogs, config, successCount, failCount }: {
  syncLogs: any[]; config: any; successCount: number; failCount: number
}) {
  const mode = config?.hubspotMode || 'MOCK'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HubSpot Integration</h1>
        <p className="text-content-muted text-sm mt-1">Contact sync log and status</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-accent">{successCount}</p>
          <p className="text-sm text-content-muted mt-1">Successful syncs</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-400">{failCount}</p>
          <p className="text-sm text-content-muted mt-1">Failed syncs</p>
        </div>
        <div className="card text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-2 ${mode === 'MOCK' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <span className={`w-2 h-2 rounded-full ${mode === 'MOCK' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {mode}
          </div>
          <p className="text-sm text-content-muted">{mode === 'MOCK' ? 'Demo mode' : 'Live sync'}</p>
        </div>
      </div>

      {mode === 'MOCK' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Running in <strong>Mock mode</strong> — contacts are logged locally but not sent to HubSpot.
          To enable real sync, go to Admin → Settings.
        </div>
      )}

      {/* Sync log table */}
      <div className="card">
        <h2 className="font-semibold mb-4">Recent Sync Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-content-muted border-b border-surface-border">
                <th className="pb-3 pr-4">Contact</th>
                <th className="pb-3 pr-4">Company</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">HubSpot ID</th>
                <th className="pb-3">Synced at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {syncLogs.map(log => {
                let response: any = {}
                try { response = JSON.parse(log.response || '{}') } catch {}
                return (
                  <tr key={log.id} className="table-row">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{log.lead?.firstName} {log.lead?.lastName}</p>
                      <p className="text-xs text-content-muted">{log.lead?.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-content-muted">{log.lead?.company}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge text-xs ${log.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-content-muted font-mono">{response.id || '—'}</td>
                    <td className="py-3 text-xs text-content-muted">
                      {new Date(log.syncedAt).toLocaleString('en-GB')}
                    </td>
                  </tr>
                )
              })}
              {syncLogs.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-content-muted">No sync history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
