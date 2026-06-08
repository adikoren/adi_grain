'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Fuse from 'fuse.js'
import { leadTemperature } from '@/lib/icp-score'

interface LeadMatch {
  id: string; firstName: string; lastName: string
  company: string; jobTitle: string | null; email: string | null
  icpScore: number | null; tags: string; hubspotContactId: string | null
  conferences: Array<{ conference: { name: string; startDate: string }; engagementNotes: string | null; capturedAt: string }>
}

const WARMTH_CLS: Record<string, string> = {
  Qualified: 'bg-emerald-100 text-emerald-700',
  Warm:      'bg-amber-100 text-amber-700',
  Cold:      'bg-slate-100 text-slate-500',
}

const JOB_TITLE_CHIPS = [
  'CFO', 'VP Finance', 'Head of Payments', 'Head of Treasury',
  'Head of Partnerships', 'COO', 'Product Lead', 'Payments Manager',
  'Treasury Manager', 'BD Manager', 'Founder / CEO',
]

function RelationshipContext({ match }: { match: LeadMatch }) {
  const tags: string[] = (() => { try { return JSON.parse(match.tags || '[]') } catch { return [] } })()
  const warmth = leadTemperature(tags)
  const confs = [...match.conferences].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
  const lastSeen = confs[0]

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <div>
          <p className="font-semibold text-sm text-amber-900">You've met {match.firstName} before!</p>
          <p className="text-xs text-amber-700">
            {match.company} · {match.jobTitle || 'Unknown role'} · met {confs.length}× at conference{confs.length > 1 ? 's' : ''}
          </p>
        </div>
        <span className={`badge text-xs ml-auto ${WARMTH_CLS[warmth]}`}>{warmth}</span>
      </div>

      {/* Conference history */}
      <div className="space-y-2">
        {confs.map((c, i) => (
          <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-amber-200">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-content-primary">{c.conference.name}</span>
              <span className="text-content-muted">{new Date(c.capturedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
            </div>
            {c.engagementNotes && <p className="text-content-secondary italic">"{c.engagementNotes}"</p>}
          </div>
        ))}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className="badge bg-white border border-amber-200 text-amber-800 text-xs">{t.replace('_', ' ')}</span>
          ))}
        </div>
      )}

      {match.hubspotContactId && (
        <p className="text-xs text-emerald-700 font-medium">✓ Already in HubSpot ({match.hubspotContactId})</p>
      )}

      {lastSeen?.engagementNotes && (
        <div className="bg-brand-navy/5 rounded-lg p-2.5 text-xs">
          <p className="font-semibold text-content-primary mb-0.5">Recommended next action:</p>
          <p className="text-content-secondary">
            {warmth === 'Qualified' ? 'Push to demo — they\'re ready.' :
             warmth === 'Warm' ? 'Continue conversation. Reference your last meeting and follow up on their pain points.' :
             'Re-qualify. Check if situation has changed since you last met.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function CapturePage() {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState<'form' | 'saving'>('form')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: params.get('company') || '',
    jobTitle: params.get('jobTitle') || '',
    linkedinUrl: '', notes: '',
  })
  const [ocrRunning, setOcrRunning] = useState(false)
  const [rawText, setRawText] = useState('')
  const [relationshipMatch, setRelationshipMatch] = useState<LeadMatch | null>(null)
  const [otherMatches, setOtherMatches] = useState<LeadMatch[]>([])
  const [mergeLeadId, setMergeLeadId] = useState<string | null>(null)
  const [allLeads, setAllLeads] = useState<LeadMatch[]>([])
  const [currentConf, setCurrentConf] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Company combobox state
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<{ context: string; icpRelevance: string; followUpAngle: string } | null>(null)
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false)
  const [aiDismissed, setAiDismissed] = useState(false)

  const confIdFromUrl = params.get('conferenceId')

  useEffect(() => {
    fetch('/api/leads?all=1').then(r => r.json()).then(d => setAllLeads(d.leads || []))
    if (confIdFromUrl) {
      setCurrentConf({ id: confIdFromUrl, name: params.get('conferenceName') || '' })
    } else {
      fetch('/api/users/current-conference').then(r => r.json()).then(d => setCurrentConf(d.conference))
    }
  }, [])

  // Click-outside to close company dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  async function fetchCompanySuggestions(q: string) {
    const url = `/api/leads/companies?q=${encodeURIComponent(q)}${currentConf?.id ? `&conferenceId=${currentConf.id}` : ''}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setCompanySuggestions(data.companies || [])
      setShowCompanyDropdown(true)
    } catch {
      setCompanySuggestions([])
    }
  }

  function updateForm(k: keyof typeof form, v: string) {
    const next = { ...form, [k]: v }
    setForm(next)

    // Clear AI suggestion when company changes
    if (k === 'company') {
      setAiSuggestion(null)
      setAiDismissed(false)
    }

    if (allLeads.length === 0) return

    // Email exact match first
    if (next.email) {
      const emailMatch = allLeads.find(l => l.email?.toLowerCase() === next.email.toLowerCase())
      if (emailMatch) {
        setRelationshipMatch(emailMatch)
        setMergeLeadId(emailMatch.id)
        setOtherMatches([])
        return
      }
    }

    // Fuzzy name + company match
    if (next.firstName && next.lastName) {
      const fuse = new Fuse(allLeads, { keys: ['firstName', 'lastName', 'company'], threshold: 0.4 })
      const res = fuse.search(`${next.firstName} ${next.lastName} ${next.company}`).slice(0, 3)
      const top = res[0]
      if (top && (top.score || 1) < 0.5 && top.item.conferences.length > 0) {
        setRelationshipMatch(top.item)
        setMergeLeadId(top.item.id)
        setOtherMatches(res.slice(1).map(r => r.item))
      } else if (res.length > 0) {
        setRelationshipMatch(null)
        setMergeLeadId(null)
        setOtherMatches(res.map(r => r.item))
      } else {
        setRelationshipMatch(null)
        setMergeLeadId(null)
        setOtherMatches([])
      }
    } else {
      setRelationshipMatch(null)
      setMergeLeadId(null)
      setOtherMatches([])
    }
  }

  async function handleCardScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrRunning(true)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      setRawText(text)
      parseOcr(text)
    } catch (err) {
      console.error('OCR failed', err)
    } finally {
      setOcrRunning(false)
    }
  }

  function parseOcr(text: string) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const phoneMatch = text.match(/[\+\d][\d\s\-\(\)]{7,15}/)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const nameLine = lines[0] || ''
    const parts = nameLine.split(' ')
    const next = {
      ...form,
      email: emailMatch?.[0] || form.email,
      phone: phoneMatch?.[0] || form.phone,
      firstName: parts[0] || form.firstName,
      lastName: parts.slice(1).join(' ') || form.lastName,
    }
    setForm(next)
    if (next.email) updateForm('email', next.email)
  }

  async function handleGetAiSuggestion() {
    if (!form.company || !form.jobTitle) return
    setLoadingAiSuggestion(true)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/leads/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company,
          jobTitle: form.jobTitle,
          conferenceId: currentConf?.id,
          conferenceName: currentConf?.name,
        }),
      })
      const data = await res.json()
      if (data.suggestions) {
        setAiSuggestion(data.suggestions)
        setAiDismissed(false)
      } else if (data.reason === 'no_key') {
        setAiSuggestion({ context: 'AI key not configured', icpRelevance: '', followUpAngle: '' })
        setAiDismissed(false)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAiSuggestion(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.company) { setError('First name, last name, and company are required'); return }
    setStep('saving')
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, rawCardText: rawText, conferenceId: currentConf?.id, mergeLeadId }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to save lead')
      setStep('form')
    }
  }

  if (step === 'saving') return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-content-muted">Saving lead…</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-content-muted hover:text-content-primary">←</button>
        <div>
          <h1 className="text-xl font-bold">Add Lead</h1>
          {currentConf && <p className="text-xs text-content-muted">@ {currentConf.name}</p>}
        </div>
      </div>

      {/* Card scan */}
      <div className="card mb-4 border-dashed border-2 border-surface-border hover:border-brand-accent/50 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCardScan} />
        <div className="text-center py-2">
          {ocrRunning ? (
            <><div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-sm text-content-muted">Scanning card…</p></>
          ) : (
            <><p className="text-2xl mb-1">📷</p><p className="text-sm text-content-secondary font-medium">Scan Business Card</p><p className="text-xs text-content-muted">Auto-fills form from photo</p></>
          )}
        </div>
      </div>

      {/* Relationship context — rich card for known contacts */}
      {relationshipMatch && (
        <div className="mb-4">
          <RelationshipContext match={relationshipMatch} />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => { setMergeLeadId(relationshipMatch.id) }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${mergeLeadId === relationshipMatch.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy'}`}>
              {mergeLeadId === relationshipMatch.id ? '✓ Add to their history' : 'Add to their history'}
            </button>
            <button onClick={() => { setMergeLeadId(null); setRelationshipMatch(null) }}
              className="text-xs text-content-muted hover:text-content-primary">
              Create new contact instead
            </button>
          </div>
        </div>
      )}

      {/* Inline name suggestions — shown when typing name with no full relationship context */}
      {!relationshipMatch && otherMatches.length > 0 && (
        <div className="mb-4 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted px-3 pt-2.5 pb-1">Similar contacts</p>
          {otherMatches.map((m, i) => (
            <button key={m.id} onClick={() => setMergeLeadId(mergeLeadId === m.id ? null : m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-t border-surface-border first:border-0 hover:bg-surface-raised/80 ${mergeLeadId === m.id ? 'bg-brand-navy/5 border-l-2 border-l-brand-navy' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-brand-navy/10 flex items-center justify-center text-xs font-bold text-brand-navy flex-shrink-0">
                {m.firstName[0]}{m.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary">{m.firstName} {m.lastName}</p>
                <p className="text-xs text-content-muted truncate">{m.company}{m.jobTitle ? ` · ${m.jobTitle}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 transition-colors ${mergeLeadId === m.id ? 'bg-brand-navy text-white' : 'bg-surface-muted text-content-muted'}`}>
                {mergeLeadId === m.id ? '✓ Same person' : 'Same person?'}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="cap-firstName" className="label">First name *</label><input id="cap-firstName" className="input" value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} /></div>
          <div><label htmlFor="cap-lastName" className="label">Last name *</label><input id="cap-lastName" className="input" value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} /></div>
        </div>

        {/* Company combobox */}
        <div>
          <label htmlFor="cap-company" className="label">Company *</label>
          <div ref={companyRef} className="relative">
            <input
              id="cap-company"
              className="input w-full"
              value={form.company}
              autoComplete="off"
              onChange={e => {
                updateForm('company', e.target.value)
                fetchCompanySuggestions(e.target.value)
              }}
              onFocus={() => fetchCompanySuggestions(form.company)}
            />
            {showCompanyDropdown && companySuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-surface-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {companySuggestions.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-raised transition-colors"
                      onMouseDown={e => {
                        e.preventDefault()
                        updateForm('company', c)
                        setShowCompanyDropdown(false)
                        setAiSuggestion(null)
                        setAiDismissed(false)
                      }}
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Job title chips */}
        <div>
          <label htmlFor="cap-jobTitle" className="label">Job title</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {JOB_TITLE_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => updateForm('jobTitle', chip)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  form.jobTitle === chip
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy/40 hover:text-brand-navy'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <input id="cap-jobTitle" className="input" value={form.jobTitle} onChange={e => updateForm('jobTitle', e.target.value)} />
        </div>

        {/* AI suggestion panel — shown after company + jobTitle filled */}
        {form.company && form.jobTitle && !aiDismissed && (
          <div>
            {!aiSuggestion && (
              <button
                type="button"
                onClick={handleGetAiSuggestion}
                disabled={loadingAiSuggestion}
                className="text-xs text-brand-accent hover:text-brand-navy flex items-center gap-1.5 transition-colors"
                data-testid="ai-suggest-btn"
              >
                {loadingAiSuggestion ? (
                  <><div className="w-3.5 h-3.5 border border-brand-accent border-t-transparent rounded-full animate-spin" /> Getting AI context…</>
                ) : (
                  <>✨ Get AI context</>
                )}
              </button>
            )}
            {aiSuggestion && (
              <div className="rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-3 space-y-2 relative" data-testid="ai-suggestion-panel">
                <button
                  type="button"
                  onClick={() => { setAiDismissed(true); setAiSuggestion(null) }}
                  className="absolute top-2 right-2 text-content-muted hover:text-content-primary text-base leading-none"
                  aria-label="Dismiss AI panel"
                >
                  ×
                </button>
                {aiSuggestion.context === 'AI key not configured' ? (
                  <p className="text-xs text-amber-600">AI key not configured</p>
                ) : (
                  <>
                    {aiSuggestion.context && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Company context</p>
                        <p className="text-xs text-content-secondary">{aiSuggestion.context}</p>
                      </div>
                    )}
                    {aiSuggestion.icpRelevance && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Why they matter</p>
                        <p className="text-xs text-content-secondary">{aiSuggestion.icpRelevance}</p>
                      </div>
                    )}
                    {aiSuggestion.followUpAngle && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Follow-up angle</p>
                        <p className="text-xs text-content-secondary">{aiSuggestion.followUpAngle}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div><label htmlFor="cap-email" className="label">Email</label><input id="cap-email" className="input" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} /></div>
        <div><label htmlFor="cap-phone" className="label">Phone</label><input id="cap-phone" className="input" type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} /></div>
        <div><label htmlFor="cap-linkedin" className="label">LinkedIn URL</label><input id="cap-linkedin" className="input" value={form.linkedinUrl} onChange={e => updateForm('linkedinUrl', e.target.value)} /></div>
        <div><label htmlFor="cap-notes" className="label">Notes</label><textarea id="cap-notes" className="input resize-none" rows={3} value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="What did you talk about?" /></div>
        <button type="submit" className="btn-primary w-full flex justify-center text-base py-3">Save Lead</button>
      </form>
    </div>
  )
}
