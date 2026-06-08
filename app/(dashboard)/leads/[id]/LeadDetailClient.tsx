'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { scoreIcpBadge } from '@/lib/icp-score'

export default function LeadDetailClient({ lead, isManager }: { lead: any; isManager: boolean }) {
  const router = useRouter()
  const [followUp, setFollowUp] = useState(lead.followUpDraft || '')
  const [arc, setArc] = useState('')
  const [aiSummary, setAiSummary] = useState(lead.aiSummary || '')
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  const [loadingArc, setLoadingArc] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const badge = scoreIcpBadge(lead.icpScore || 0)

  const hasCurrentCompany = lead.currentCompany && lead.currentCompany !== lead.company

  async function draftFollowUp() {
    setLoadingFollowUp(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'draft-followup' }),
    })
    const data = await res.json()
    setFollowUp(data.draft || '')
    setLoadingFollowUp(false)
  }

  async function getArc() {
    setLoadingArc(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'relationship-arc' }),
    })
    const data = await res.json()
    setArc(data.summary || '')
    setLoadingArc(false)
  }

  async function generateSummary() {
    setLoadingSummary(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'relationship-arc' }),
    })
    const data = await res.json()
    const summary = data.summary || ''
    setAiSummary(summary)
    // Save to DB
    if (summary) {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-summary', summary }),
      })
    }
    setLoadingSummary(false)
  }

  async function regenerateSummary() {
    setLoadingSummary(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'relationship-arc' }),
    })
    const data = await res.json()
    const summary = data.summary || ''
    setAiSummary(summary)
    if (summary) {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-summary', summary }),
      })
    }
    setLoadingSummary(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-content-muted hover:text-content-primary">←</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.firstName} {lead.lastName}</h1>
          <p className="text-content-muted text-sm">{lead.jobTitle || ''}{lead.jobTitle && lead.company ? ' · ' : ''}{lead.company}</p>
        </div>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>

      {/* Current company banner */}
      {hasCurrentCompany && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
          <span>⚡</span>
          <span>Now at <strong>{lead.currentCompany}</strong> (was at {lead.company})</span>
        </div>
      )}

      {/* Contact info */}
      <div className="card grid grid-cols-2 gap-4">
        {lead.email && <div><p className="text-xs text-content-muted uppercase tracking-wide">Email</p><a href={`mailto:${lead.email}`} className="text-brand-accent text-sm hover:underline">{lead.email}</a></div>}
        {lead.phone && <div><p className="text-xs text-content-muted uppercase tracking-wide">Phone</p><p className="text-sm">{lead.phone}</p></div>}
        {lead.linkedinUrl && <div><p className="text-xs text-content-muted uppercase tracking-wide">LinkedIn</p><a href={lead.linkedinUrl} target="_blank" rel="noopener" className="text-brand-accent text-sm hover:underline truncate block">{lead.linkedinUrl}</a></div>}
        {lead.hubspotContactId && <div><p className="text-xs text-content-muted uppercase tracking-wide">HubSpot</p><p className="text-sm text-green-400">✓ {lead.hubspotContactId}</p></div>}
        <div><p className="text-xs text-content-muted uppercase tracking-wide">Captured by</p><p className="text-sm">{lead.capturedBy?.name || '—'}</p></div>
        <div><p className="text-xs text-content-muted uppercase tracking-wide">ICP Score</p><p className="text-sm">{lead.icpScore ?? '—'} / 100</p></div>
        {hasCurrentCompany && (
          <>
            <div><p className="text-xs text-content-muted uppercase tracking-wide">Current Company</p><p className="text-sm font-medium text-content-primary">{lead.currentCompany}</p></div>
            <div><p className="text-xs text-content-muted uppercase tracking-wide">First Seen At</p><p className="text-sm text-content-secondary">{lead.company}</p></div>
          </>
        )}
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="card">
          <p className="text-xs text-content-muted uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      {/* AI Relationship Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Relationship Summary</h2>
          {aiSummary ? (
            <button onClick={regenerateSummary} disabled={loadingSummary} className="btn-secondary text-xs">
              {loadingSummary ? 'Generating…' : '↺ Regenerate'}
            </button>
          ) : (
            <button onClick={generateSummary} disabled={loadingSummary} className="btn-secondary text-xs">
              {loadingSummary ? 'Generating…' : '✨ Generate AI summary'}
            </button>
          )}
        </div>
        {aiSummary ? (
          <>
            <p className="text-sm text-content-secondary whitespace-pre-wrap">{aiSummary}</p>
            {lead.aiSummaryAt && (
              <p className="text-xs text-content-muted mt-2">Last updated {new Date(lead.aiSummaryAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
          </>
        ) : (
          <p className="text-content-muted text-sm">Generate a cached AI summary of this relationship</p>
        )}
      </div>

      {/* Conference history */}
      <div className="card">
        <h2 className="font-semibold mb-3">Conference Appearances ({lead.conferences.length})</h2>
        {lead.conferences.length === 0 && <p className="text-content-muted text-sm">No conference data</p>}
        <div className="space-y-3">
          {lead.conferences.map((cl: any) => (
            <div key={cl.id} className="p-3 bg-surface-raised rounded-lg">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{cl.conference.name}</p>
                <p className="text-xs text-content-muted">{new Date(cl.conference.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
              </div>
              <p className="text-xs text-content-muted">{cl.conference.city}, {cl.conference.country}</p>
              {cl.companyAtTime && cl.companyAtTime !== lead.company && (
                <p className="text-xs text-blue-600 mt-0.5">was at {cl.companyAtTime}</p>
              )}
              {cl.engagementNotes && <p className="text-xs text-content-secondary mt-1">{cl.engagementNotes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* AI: Relationship arc */}
      {lead.conferences.length >= 2 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Relationship Arc</h2>
            <button onClick={getArc} disabled={loadingArc} className="btn-secondary text-xs">
              {loadingArc ? 'Analysing…' : '✨ Analyse Arc'}
            </button>
          </div>
          {arc && <p className="text-sm text-content-secondary whitespace-pre-wrap">{arc}</p>}
          {!arc && <p className="text-content-muted text-sm">AI summary of engagement across conferences</p>}
        </div>
      )}

      {/* AI: Follow-up draft */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Follow-up Email</h2>
          <button onClick={draftFollowUp} disabled={loadingFollowUp} className="btn-secondary text-xs">
            {loadingFollowUp ? 'Drafting…' : '✨ Draft with AI'}
          </button>
        </div>
        {followUp
          ? <textarea className="input resize-none w-full" rows={8} value={followUp} onChange={e => setFollowUp(e.target.value)} />
          : <p className="text-content-muted text-sm">Generate a personalised follow-up email using AI</p>}
        {followUp && (
          <button onClick={() => { navigator.clipboard.writeText(followUp) }} className="btn-ghost text-xs mt-2">Copy to clipboard</button>
        )}
      </div>

      {/* HubSpot sync log */}
      {lead.syncLogs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-sm">HubSpot Sync History</h2>
          <div className="space-y-2">
            {lead.syncLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between text-xs">
                <span className={log.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>{log.status}</span>
                <span className="text-content-muted">{new Date(log.syncedAt).toLocaleString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
