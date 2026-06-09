'use client'
import { useState } from 'react'
import Link from 'next/link'

interface SyncLog {
  id: string
  status: string
  isMockSync: boolean
  response: string | null
  syncedAt: string
}

interface LeadForSync {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  company: string
  jobTitle: string | null
  linkedinUrl: string | null
  notes: string | null
  aiSummary: string | null
  icpScore: number | null
  tags: string
  hubspotContactId: string | null
  capturedAt: string
  capturedBy: { name: string }
  conferences: Array<{
    conference: { name: string; startDate: string }
    capturedAt: string
    companyAtTime: string | null
    jobTitleAtTime: string | null
  }>
  syncLogs: SyncLog[]
}

type SyncStatus = 'synced' | 'failed' | 'ready' | 'needs_review' | 'missing_fields' | 'not_synced'

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

function getSyncStatus(lead: LeadForSync): SyncStatus {
  if (lead.hubspotContactId) return 'synced'
  const lastLog = lead.syncLogs[0]
  if (lastLog?.status === 'FAILED') return 'failed'
  if (!lead.email) return 'missing_fields'
  const tags = parseTags(lead.tags)
  if (tags.includes('NEEDS_REVIEW')) return 'needs_review'
  if (lead.icpScore === null) return 'not_synced'
  return 'ready'
}

function getWarmth(lead: LeadForSync): string {
  const tags = parseTags(lead.tags)
  if (tags.some(t => t === 'HOT' || t === 'QUALIFIED')) return 'Hot'
  if (tags.some(t => t === 'WARM')) return 'Warm'
  if (lead.icpScore === null) return 'Not scored'
  if (lead.icpScore >= 80) return 'Hot'
  if (lead.icpScore >= 60) return 'Warm'
  return 'Cold'
}

function buildPreviewPayload(lead: LeadForSync): Record<string, string> {
  const warmth = getWarmth(lead)
  const tags = parseTags(lead.tags)
  const lastConf = lead.conferences[0]
  const recommended =
    warmth === 'Hot'  ? 'Push to demo — high ICP score.' :
    warmth === 'Warm' ? 'Follow up — reference your last meeting.' :
    lead.icpScore !== null ? 'Re-qualify — check if situation has changed.' :
    'Score and qualify before handoff.'

  return {
    'First name':          lead.firstName,
    'Last name':           lead.lastName,
    'Email':               lead.email         || '(not set)',
    'Phone':               lead.phone         || '(not set)',
    'LinkedIn':            lead.linkedinUrl   || '(not set)',
    'Company':             lead.company,
    'Job title':           lead.jobTitle      || '(not set)',
    'Conference source':   lastConf?.conference.name || '(no conference)',
    'Captured by':         lead.capturedBy.name,
    'Notes':               lead.notes         || '(no notes)',
    'Lead warmth':         warmth,
    'Tags':                tags.join(', ')    || '(none)',
    'Relationship summary': lead.aiSummary    || '(not generated)',
    'Recommended action':  recommended,
  }
}

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  synced:         { label: 'Synced',                color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  failed:         { label: 'Sync failed',           color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500' },
  ready:          { label: 'Ready to sync',         color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  needs_review:   { label: 'Needs review',          color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  missing_fields: { label: 'Missing required fields', color: 'text-slate-600', bg: 'bg-slate-50',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  not_synced:     { label: 'Not synced yet',        color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100',   dot: 'bg-slate-300' },
}

const FILTER_ORDER: SyncStatus[] = ['failed', 'ready', 'needs_review', 'missing_fields', 'synced', 'not_synced']

function StatusBadge({ status, isMock }: { status: SyncStatus; isMock?: boolean }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {isMock && status === 'synced' && <span className="text-[10px] opacity-70">· mock</span>}
    </span>
  )
}

function PayloadPreview({ payload, isMockMode }: { payload: Record<string, string>; isMockMode: boolean }) {
  return (
    <div className="mt-3 pt-3 border-t border-surface-border">
      <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-2">
        {isMockMode ? 'What would be sent to HubSpot (Mock — no real call)' : 'HubSpot payload preview'}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {Object.entries(payload).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs min-w-0">
            <span className="text-content-muted shrink-0 w-32 truncate">{k}</span>
            <span className={`text-content-primary truncate ${v.startsWith('(') ? 'text-content-muted italic' : ''}`}>{v}</span>
          </div>
        ))}
      </div>
      {isMockMode && (
        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          Mock mode is active — no real HubSpot API call will be made. The sync will be recorded locally with a mock ID.
        </p>
      )}
    </div>
  )
}

function LeadCard({
  lead, mode, onSync, syncing, error,
}: {
  lead: LeadForSync
  mode: 'MOCK' | 'REAL'
  onSync: (id: string) => void
  syncing: boolean
  error?: string
}) {
  const [showPreview, setShowPreview] = useState(false)
  const status = getSyncStatus(lead)
  const cfg = STATUS_CONFIG[status]
  const payload = buildPreviewPayload(lead)
  const lastConf = lead.conferences[0]
  const lastLog = lead.syncLogs[0]
  const isMockSynced = status === 'synced' && !!lead.hubspotContactId?.startsWith('mock_')

  let errorText = ''
  if (status === 'failed' && lastLog) {
    try { errorText = JSON.parse(lastLog.response || '{}').error || 'Unknown error' } catch {}
  }

  return (
    <div className={`rounded-xl border ${status === 'failed' ? 'border-red-200' : status === 'ready' ? 'border-blue-100' : 'border-surface-border'} bg-white overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
            {lead.firstName[0]}{lead.lastName[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-content-primary">{lead.firstName} {lead.lastName}</p>
              <StatusBadge status={status} isMock={isMockSynced} />
              {lead.icpScore !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${lead.icpScore >= 80 ? 'bg-emerald-100 text-emerald-700' : lead.icpScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {lead.icpScore >= 80 ? 'A' : lead.icpScore >= 60 ? 'B' : 'C'} · {Math.round(lead.icpScore)}
                </span>
              )}
            </div>
            <p className="text-xs text-content-muted mt-0.5">{lead.jobTitle || '—'} · {lead.company}</p>
            <div className="flex flex-wrap gap-x-3 mt-0.5">
              {lead.email  && <p className="text-xs text-content-muted">✉ {lead.email}</p>}
              {lead.phone  && <p className="text-xs text-content-muted">📞 {lead.phone}</p>}
              {lastConf    && <p className="text-xs text-content-muted">📍 {lastConf.conference.name}</p>}
            </div>
            {status === 'missing_fields' && (
              <p className="text-xs text-slate-500 mt-1">⚠ Email is required for HubSpot contact creation.</p>
            )}
            {status === 'failed' && errorText && (
              <p className="text-xs text-red-600 mt-1">Error: {errorText}</p>
            )}
            {status === 'synced' && lead.hubspotContactId && (
              <p className="text-xs text-emerald-600 mt-1 font-mono">
                HubSpot ID: {lead.hubspotContactId}
                {isMockSynced && ' (mock — not a real HubSpot record)'}
              </p>
            )}
            {error && <p className="text-xs text-red-600 mt-1">Sync error: {error}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {(status === 'ready' || status === 'failed') && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => onSync(lead.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                  mode === 'MOCK'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-brand-navy hover:bg-brand-navy/90 text-white'
                }`}
              >
                {syncing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" />
                    Syncing…
                  </span>
                ) : mode === 'MOCK' ? (
                  status === 'failed' ? 'Retry (mock)' : 'Mock Sync'
                ) : (
                  status === 'failed' ? 'Retry Sync' : 'Sync to HubSpot'
                )}
              </button>
            )}
            {(status === 'needs_review' || status === 'missing_fields') && (
              <Link href={`/leads/${lead.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-border bg-white hover:bg-surface-raised transition-colors">
                Review lead →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowPreview(v => !v)}
              className="text-xs text-content-muted hover:text-content-primary transition-colors"
            >
              {showPreview ? 'Hide preview' : 'Preview payload'}
            </button>
          </div>
        </div>

        {showPreview && <PayloadPreview payload={payload} isMockMode={mode === 'MOCK'} />}
      </div>
    </div>
  )
}

export default function HubspotClient({
  initialLeads, mode, hasApiKey,
}: {
  initialLeads: LeadForSync[]
  mode: 'MOCK' | 'REAL'
  hasApiKey: boolean
}) {
  const [leads, setLeads] = useState<LeadForSync[]>(
    Array.isArray(initialLeads) ? initialLeads : [],
  )
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({})
  const [activeFilter, setActiveFilter] = useState<SyncStatus | 'all'>('all')
  const [showLog, setShowLog] = useState(false)

  const safeLeads = Array.isArray(leads) ? leads : []

  const counts: Record<SyncStatus, number> = {
    synced: 0, failed: 0, ready: 0, needs_review: 0, missing_fields: 0, not_synced: 0,
  }
  for (const l of safeLeads) counts[getSyncStatus(l)]++

  const filteredLeads = activeFilter === 'all'
    ? safeLeads
    : safeLeads.filter(l => getSyncStatus(l) === activeFilter)

  // All sync logs across all leads, sorted by date desc
  const allLogs = safeLeads
    .flatMap(l => l.syncLogs.map(lg => ({ ...lg, lead: l })))
    .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
    .slice(0, 30)

  async function handleSync(leadId: string) {
    setSyncingIds(prev => new Set(Array.from(prev).concat(leadId)))
    setSyncErrors(prev => { const n = { ...prev }; delete n[leadId]; return n })

    const res = await fetch('/api/hubspot/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    })
    const data = await res.json()
    setSyncingIds(prev => { const n = new Set(prev); n.delete(leadId); return n })

    if (data.success) {
      const newLog: SyncLog = {
        id: 'new_' + Date.now(),
        status: 'SUCCESS',
        isMockSync: data.isMockSync ?? (mode === 'MOCK'),
        response: null,
        syncedAt: new Date().toISOString(),
      }
      setLeads(prev => prev.map(l => l.id === leadId
        ? { ...l, hubspotContactId: data.hubspotId, syncLogs: [newLog, ...l.syncLogs] }
        : l
      ))
    } else {
      const failLog: SyncLog = {
        id: 'fail_' + Date.now(),
        status: 'FAILED',
        isMockSync: mode === 'MOCK',
        response: JSON.stringify({ error: data.error }),
        syncedAt: new Date().toISOString(),
      }
      setSyncErrors(prev => ({ ...prev, [leadId]: data.error || 'Sync failed' }))
      setLeads(prev => prev.map(l => l.id === leadId
        ? { ...l, syncLogs: [failLog, ...l.syncLogs] }
        : l
      ))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">HubSpot Sync</h1>
          <p className="text-content-muted text-sm mt-1">Lead handoff pipeline · {safeLeads.length} total leads</p>
        </div>
        <Link href="/admin/settings" className="text-xs text-brand-accent hover:underline">
          Settings →
        </Link>
      </div>

      {/* Mode banner */}
      {mode === 'MOCK' ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
          <span className="text-xl flex-shrink-0">🟡</span>
          <div>
            <p className="font-semibold text-amber-900">Mock mode is active</p>
            <p className="text-sm text-amber-700 mt-0.5">
              No real HubSpot API calls are being made. Syncing leads will log them locally with a mock ID and mark them as synced — useful for testing the full handoff flow. To connect to real HubSpot,{' '}
              <Link href="/admin/settings" className="underline">configure your API key in Settings</Link>.
            </p>
          </div>
        </div>
      ) : hasApiKey ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="text-xl">🟢</span>
          <div>
            <p className="font-semibold text-emerald-800">Connected to real HubSpot</p>
            <p className="text-sm text-emerald-700 mt-0.5">Synced leads will be created as real contacts in your HubSpot CRM.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">Real mode — API key not configured</p>
            <p className="text-sm text-red-700 mt-0.5">
              <Link href="/admin/settings" className="underline">Add your HubSpot API key in Settings</Link> to enable live sync.
            </p>
          </div>
        </div>
      )}

      {/* Status summary + filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            activeFilter === 'all' ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-surface-border text-content-secondary hover:border-brand-navy/40'
          }`}
        >
          All ({safeLeads.length})
        </button>
        {FILTER_ORDER.map(s => {
          const n = counts[s]
          if (n === 0) return null
          const cfg = STATUS_CONFIG[s]
          const isActive = activeFilter === s
          return (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                isActive ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white border-surface-border text-content-secondary hover:border-brand-navy/40'
              }`}
            >
              {cfg.label} ({n})
            </button>
          )
        })}
      </div>

      {/* Lead list */}
      <div className="space-y-2.5">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-content-muted text-sm">No leads in this category</div>
        ) : (
          filteredLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              mode={mode}
              onSync={handleSync}
              syncing={syncingIds.has(lead.id)}
              error={syncErrors[lead.id]}
            />
          ))
        )}
      </div>

      {/* Sync activity log */}
      {allLogs.length > 0 && (
        <div className="card">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowLog(v => !v)}
          >
            <h2 className="font-semibold text-sm">Sync Activity Log</h2>
            <span className="text-xs text-content-muted">{showLog ? 'Hide ▲' : `Show (${allLogs.length}) ▼`}</span>
          </button>

          {showLog && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-content-muted border-b border-surface-border">
                    <th className="pb-2 pr-4">Contact</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Mode</th>
                    <th className="pb-2 pr-4">HubSpot ID</th>
                    <th className="pb-2">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {allLogs.map(log => {
                    let resp: any = {}
                    try { resp = JSON.parse(log.response || '{}') } catch {}
                    return (
                      <tr key={log.id}>
                        <td className="py-2 pr-4">
                          <Link href={`/leads/${log.lead.id}`} className="font-medium hover:text-brand-accent transition-colors">
                            {log.lead.firstName} {log.lead.lastName}
                          </Link>
                          <p className="text-content-muted">{log.lead.company}</p>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`font-medium ${log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${log.isMockSync ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {log.isMockSync ? 'MOCK' : 'REAL'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-content-muted">{resp.id || '—'}</td>
                        <td className="py-2 text-content-muted">
                          {new Date(log.syncedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
