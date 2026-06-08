import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!['ADMIN', 'MANAGER'].includes(session!.user.role)) {
    return <div className="p-6 text-red-400">Unauthorized</div>
  }

  const [totalLeads, totalConferences, totalUsers, syncedLeads] = await Promise.all([
    db.lead.count(),
    db.conference.count(),
    db.user.count({ where: { isActive: true } }),
    db.lead.count({ where: { hubspotContactId: { not: null } } }),
  ])

  // Leads per rep
  const leadsPerRep = await db.lead.groupBy({
    by: ['capturedById'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })
  const repIds = leadsPerRep.map(r => r.capturedById)
  const reps = await db.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true } })
  const repMap = Object.fromEntries(reps.map(r => [r.id, r.name]))

  // Leads per conference
  const leadsPerConf = await db.conferenceLead.groupBy({
    by: ['conferenceId'],
    _count: { leadId: true },
    orderBy: { _count: { leadId: 'desc' } },
    take: 10,
  })
  const confIds = leadsPerConf.map(r => r.conferenceId)
  const conferences = await db.conference.findMany({ where: { id: { in: confIds } }, select: { id: true, name: true } })
  const confMap = Object.fromEntries(conferences.map(c => [c.id, c.name]))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-content-muted text-sm mt-1">Pipeline and conference performance overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, color: 'text-brand-accent' },
          { label: 'Conferences', value: totalConferences, color: 'text-brand-accent-alt' },
          { label: 'Active Reps', value: totalUsers, color: 'text-blue-400' },
          { label: 'Synced to HubSpot', value: syncedLeads, color: 'text-green-400' },
        ].map(kpi => (
          <div key={kpi.label} className="card text-center">
            <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-sm text-content-muted mt-2">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Leads per rep */}
      <div className="card">
        <h2 className="font-semibold mb-4">Leads by Rep</h2>
        {leadsPerRep.length === 0 && <p className="text-content-muted text-sm">No data yet</p>}
        <div className="space-y-3">
          {leadsPerRep.map(row => {
            const pct = totalLeads > 0 ? (row._count.id / totalLeads) * 100 : 0
            return (
              <div key={row.capturedById}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{repMap[row.capturedById] || 'Unknown'}</span>
                  <span className="text-brand-accent font-medium">{row._count.id}</span>
                </div>
                <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div className="h-full bg-brand-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leads per conference */}
      <div className="card">
        <h2 className="font-semibold mb-4">Top Conferences by Leads</h2>
        {leadsPerConf.length === 0 && <p className="text-content-muted text-sm">No data yet</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-content-muted border-b border-surface-border">
                <th className="pb-3 pr-4">Conference</th>
                <th className="pb-3">Leads captured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {leadsPerConf.map(row => (
                <tr key={row.conferenceId} className="table-row">
                  <td className="py-3 pr-4">{confMap[row.conferenceId] || '—'}</td>
                  <td className="py-3 text-brand-accent font-medium">{row._count.leadId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-content-muted text-center">Live data from SQLite · refreshes on page load</p>
    </div>
  )
}
