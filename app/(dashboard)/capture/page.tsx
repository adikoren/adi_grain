'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'

interface LeadMatch { id: string; firstName: string; lastName: string; company: string; score: number; conferences: string[] }

export default function CapturePage() {
  const router = useRouter()
  const [step, setStep] = useState<'scan' | 'form' | 'saving'>('form')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', linkedinUrl: '', notes: '' })
  const [ocrRunning, setOcrRunning] = useState(false)
  const [rawText, setRawText] = useState('')
  const [matches, setMatches] = useState<LeadMatch[]>([])
  const [mergeLeadId, setMergeLeadId] = useState<string | null>(null)
  const [allLeads, setAllLeads] = useState<any[]>([])
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
    if (next.firstName && next.lastName && next.company && allLeads.length) {
      const fuse = new Fuse(allLeads, { keys: ['firstName', 'lastName', 'company'], threshold: 0.3 })
      const res = fuse.search(`${next.firstName} ${next.lastName} ${next.company}`).slice(0, 3)
      setMatches(res.map(r => ({ ...r.item, score: Math.round((1 - (r.score || 0)) * 100) })))
    } else {
      setMatches([])
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
    setForm(prev => ({
      ...prev,
      email: emailMatch?.[0] || prev.email,
      phone: phoneMatch?.[0] || prev.phone,
      firstName: parts[0] || prev.firstName,
      lastName: parts.slice(1).join(' ') || prev.lastName,
    }))
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

      {matches.length > 0 && (
        <div className="card border-yellow-700/40 mb-4">
          <p className="text-xs font-medium text-yellow-400 mb-2">Possible duplicate found</p>
          {matches.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-t border-surface-border first:border-0">
              <div>
                <p className="text-sm font-medium">{m.firstName} {m.lastName}</p>
                <p className="text-xs text-content-muted">{m.company}</p>
              </div>
              <button onClick={() => setMergeLeadId(mergeLeadId === m.id ? null : m.id)}
                className={`text-xs px-2 py-1 rounded transition-colors ${mergeLeadId === m.id ? 'bg-brand-accent text-brand-dark font-medium' : 'bg-surface-raised text-content-secondary hover:text-content-primary'}`}>
                {mergeLeadId === m.id ? '✓ Linking' : 'Link'}
              </button>
            </div>
          ))}
          {mergeLeadId && <p className="text-xs text-brand-accent mt-2">Will add this conference encounter to the existing contact.</p>}
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">{error}</div>}

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
