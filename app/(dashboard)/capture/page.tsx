'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const [step, setStep] = useState<'form' | 'saving'>('form')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', linkedinUrl: '', notes: '' })
  const [ocrRunning, setOcrRunning] = useState(false)
  const [rawText, setRawText] = useState('')
  const [relationshipMatch, setRelationshipMatch] = useState<LeadMatch | null>(null)
  const [otherMatches, setOtherMatches] = useState<LeadMatch[]>([])
  const [mergeLeadId, setMergeLeadId] = useState<string | null>(null)
  const [allLeads, setAllLeads] = useState<LeadMatch[]>([])
  const [currentConf, setCurrentConf] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/leads?all=1').then(r => r.json()).then(d => setAllLeads(d.leads || []))
    fetch('/api/users/current-conference').then(r => r.json()).then(d => setCurrentConf(d.conference))
  }, [])

  function updateForm(k: keyof typeof form, v: string) {
    const next = { ...form, [k]: v }
    setForm(next)

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
      const fuse = new Fuse(allLeads, { keys: ['firstName', 'lastName', 'company'], threshold: 0.3 })
      const res = fuse.search(`${next.firstName} ${next.lastName} ${next.company}`).slice(0, 3)
      const top = res[0]
      if (top && (top.score || 1) < 0.4 && top.item.conferences.length > 0) {
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

      {/* Light duplicate hints (no relationship history) */}
      {!relationshipMatch && otherMatches.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50 mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">Possible matches</p>
          {otherMatches.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-t border-amber-100 first:border-0">
              <div>
                <p className="text-sm font-medium text-content-primary">{m.firstName} {m.lastName}</p>
                <p className="text-xs text-content-muted">{m.company} · {m.jobTitle || '—'}</p>
              </div>
              <button onClick={() => setMergeLeadId(mergeLeadId === m.id ? null : m.id)}
                className={`text-xs px-2 py-1 rounded transition-colors ${mergeLeadId === m.id ? 'bg-brand-navy text-white font-medium' : 'bg-surface-raised text-content-secondary hover:text-content-primary'}`}>
                {mergeLeadId === m.id ? '✓ Link' : 'Link'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name *</label><input className="input" value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} /></div>
          <div><label className="label">Last name *</label><input className="input" value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} /></div>
        </div>
        <div><label className="label">Company *</label><input className="input" value={form.company} onChange={e => updateForm('company', e.target.value)} /></div>
        <div><label className="label">Job title</label><input className="input" value={form.jobTitle} onChange={e => updateForm('jobTitle', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} /></div>
        <div><label className="label">LinkedIn URL</label><input className="input" value={form.linkedinUrl} onChange={e => updateForm('linkedinUrl', e.target.value)} /></div>
        <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="What did you talk about?" /></div>
        <button type="submit" className="btn-primary w-full flex justify-center text-base py-3">Save Lead</button>
      </form>
    </div>
  )
}
