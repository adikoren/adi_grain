'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Fuse from 'fuse.js'
import { leadTemperature } from '@/lib/icp-score'

interface LeadMatch {
  id: string; firstName: string; lastName: string
  company: string; jobTitle: string | null; email: string | null
  phone: string | null; linkedinUrl: string | null; aiSummary: string | null
  icpScore: number | null; tags: string; hubspotContactId: string | null
  previousCompany: string | null; previousJobTitle: string | null
  conferences: Array<{
    conference: { name: string; startDate: string }
    engagementNotes: string | null; capturedAt: string
    companyAtTime: string | null; jobTitleAtTime: string | null
  }>
}

interface ConferenceItem {
  id: string; name: string; city: string; country: string
  startDate: string; endDate: string
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

// ── Name matching helpers ───────────────────────────────────────────────────

const NICKNAMES: Record<string, string[]> = {
  daniel: ['dan', 'danny'], dan: ['daniel', 'danny'], danny: ['daniel', 'dan'],
  robert: ['rob', 'bob', 'bobby'], rob: ['robert', 'bob'], bob: ['robert', 'rob'],
  william: ['will', 'bill', 'billy'], will: ['william', 'bill'], bill: ['william', 'will'],
  james: ['jim', 'jimmy'], jim: ['james'],
  michael: ['mike', 'mick'], mike: ['michael'],
  richard: ['rick', 'rich'], rick: ['richard'], rich: ['richard'],
  christopher: ['chris'], chris: ['christopher'],
  matthew: ['matt'], matt: ['matthew'],
  jonathan: ['jon'], jon: ['jonathan'],
  thomas: ['tom', 'tommy'], tom: ['thomas'],
  anthony: ['tony'], tony: ['anthony'],
  nicholas: ['nick'], nick: ['nicholas'],
  andrew: ['andy', 'drew'], andy: ['andrew'], drew: ['andrew'],
  benjamin: ['ben'], ben: ['benjamin'],
  joseph: ['joe'], joe: ['joseph'],
  samuel: ['sam'], sam: ['samuel'],
  timothy: ['tim'], tim: ['timothy'],
  edward: ['ed', 'eddie'], ed: ['edward'],
  alexander: ['alex'], alex: ['alexander', 'alexandra'], alexandra: ['alex'],
  stephen: ['steve', 'steven'], steve: ['stephen', 'steven'], steven: ['stephen', 'steve'],
  elizabeth: ['liz', 'beth', 'lisa'], liz: ['elizabeth'], beth: ['elizabeth'],
  katherine: ['kate', 'katie', 'kat'], kate: ['katherine'], katie: ['katherine'],
  jennifer: ['jen', 'jenny'], jen: ['jennifer'],
  jessica: ['jess'], jess: ['jessica'],
  stephanie: ['steph'], steph: ['stephanie'],
  victoria: ['vicky', 'vic'], vicky: ['victoria'],
  sarah: ['sara'], sara: ['sarah'],
  sophia: ['sophie'], sophie: ['sophia'],
  natalie: ['nat', 'natalia'], natalia: ['natalie', 'nat'],
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const curr = a[i - 1] === b[j - 1] ? dp[j - 1] : 1 + Math.min(dp[j - 1], dp[j], prev)
      dp[j - 1] = prev
      prev = curr
    }
    dp[b.length] = prev
  }
  return dp[b.length]
}

type MatchType = 'exact' | 'nickname' | 'initial' | 'reversed' | 'fuzzy'

interface NameMatchResult {
  lead: LeadMatch
  score: number   // 0–1, higher = better
  matchType: MatchType
}

function findNameMatches(firstName: string, lastName: string, leads: LeadMatch[]): NameMatchResult[] {
  const n  = (s: string) => s?.toLowerCase().trim() ?? ''
  const nF = n(firstName)
  const nL = n(lastName)
  const nFc = nF.replace('.', '')   // strip trailing period for initials
  const nLc = nL.replace('.', '')
  const best = new Map<string, NameMatchResult>()

  function consider(lead: LeadMatch, score: number, matchType: MatchType) {
    const prev = best.get(lead.id)
    if (!prev || score > prev.score) best.set(lead.id, { lead, score, matchType })
  }

  for (const lead of leads) {
    const sF  = n(lead.firstName)
    const sL  = n(lead.lastName)
    const sFc = sF.replace('.', '')
    const sLc = sL.replace('.', '')

    // ── Last-name anchor: full last name must match (exact or 1-char edit) ──
    const lastExact = nL === sL
    const lastClose = !lastExact && nL.length >= 3 && sL.length >= 3 && editDistance(nL, sL) <= 1
    const lFactor   = lastExact ? 1.0 : lastClose ? 0.90 : 0

    if (lFactor > 0) {
      // Exact first name
      if (nF === sF)
        consider(lead, 1.00 * lFactor, 'exact')
      // Nickname mapping (Dan ↔ Daniel, Sara ↔ Sarah, Jon ↔ Jonathan …)
      else if (NICKNAMES[nF]?.includes(sF) || NICKNAMES[sF]?.includes(nF))
        consider(lead, 0.92 * lFactor, 'nickname')
      // First-name initial: "D. Cohen" → "Daniel Cohen"
      else if (nFc.length === 1 && sF.startsWith(nFc))
        consider(lead, 0.80 * lFactor, 'initial')
      // Stored first name is initial: "D. Cohen" stored, "Daniel" entered
      else if (sFc.length === 1 && nF.startsWith(sFc))
        consider(lead, 0.80 * lFactor, 'initial')
    }

    // ── Last-name initial: "Maya S." → "Maya Santos" ────────────────────────
    // This case has nL = "s." so lFactor above is 0; handle it separately.
    if (nLc.length === 1 && sL.startsWith(nLc) && nF === sF)
      consider(lead, 0.78, 'initial')
    // Reverse: stored last name is initial
    if (sLc.length === 1 && nL.startsWith(sLc) && nF === sF)
      consider(lead, 0.78, 'initial')

    // ── Reversed entry: "Cohen Daniel" stored as "Daniel Cohen" ─────────────
    if (nF === sL && nL === sF) consider(lead, 0.85, 'reversed')
  }

  // ── Fuse fallback: catches typos & spelling variants not covered above ────
  const fuse = new Fuse(leads, { keys: ['firstName', 'lastName'], threshold: 0.45, includeScore: true })
  for (const r of fuse.search(`${firstName} ${lastName}`)) {
    const s = r.score ?? 1
    if (s < 0.30) consider(r.item, (1 - s) * 0.65, 'fuzzy')
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score)
}

const MATCH_DESCRIPTION: Record<MatchType, (entered: string, stored: string) => string> = {
  exact:    (_, stored)   => `${stored} already exists in the system`,
  nickname: (entered, stored) => `"${entered}" may be a nickname for ${stored}`,
  initial:  (entered, stored) => `"${entered}" could be the initial for ${stored}`,
  reversed: (_, stored)   => `This looks like a reversed entry for ${stored}`,
  fuzzy:    (_, stored)   => `Name is very similar to ${stored} in the database`,
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-content-muted whitespace-nowrap">{children}</h2>
      <div className="flex-1 h-px bg-surface-border" />
    </div>
  )
}

function RelationshipContext({ match }: { match: LeadMatch }) {
  const tags: string[] = (() => { try { return JSON.parse(match.tags || '[]') } catch { return [] } })()
  const warmth = leadTemperature(tags)
  const confs = [...match.conferences].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <div>
          <p className="font-semibold text-sm text-amber-900">You've met {match.firstName} before!</p>
          <p className="text-xs text-amber-700">
            {match.company} · {match.jobTitle || 'Unknown role'} · met {confs.length}× at conference{confs.length > 1 ? 's' : ''}
          </p>
          {match.previousCompany && (
            <p className="text-xs text-amber-600 mt-0.5 italic">
              Previously at {match.previousCompany}{match.previousJobTitle ? ` · ${match.previousJobTitle}` : ''}
            </p>
          )}
        </div>
        <span className={`badge text-xs ml-auto ${WARMTH_CLS[warmth]}`}>{warmth}</span>
      </div>
      <div className="space-y-2">
        {confs.map((c, i) => (
          <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-amber-200">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-content-primary">{c.conference.name}</span>
              <span className="text-content-muted">{new Date(c.capturedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
            </div>
            {(c.companyAtTime || c.jobTitleAtTime) && (
              <p className="text-content-muted mb-0.5">
                {[c.jobTitleAtTime, c.companyAtTime].filter(Boolean).join(' · ')}
              </p>
            )}
            {c.engagementNotes && <p className="text-content-secondary italic">"{c.engagementNotes}"</p>}
          </div>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => <span key={t} className="badge bg-white border border-amber-200 text-amber-800 text-xs">{t.replace('_', ' ')}</span>)}
        </div>
      )}
      {match.hubspotContactId && (
        <p className="text-xs text-emerald-700 font-medium">✓ Already in HubSpot ({match.hubspotContactId})</p>
      )}
      <div className="bg-brand-navy/5 rounded-lg p-2.5 text-xs">
        <p className="font-semibold text-content-primary mb-0.5">Recommended next action:</p>
        <p className="text-content-secondary">
          {warmth === 'Qualified' ? 'Push to demo — they\'re ready.' :
           warmth === 'Warm' ? 'Continue conversation. Reference your last meeting and follow up on their pain points.' :
           'Re-qualify. Check if situation has changed since you last met.'}
        </p>
      </div>
    </div>
  )
}

function CapturePageContent() {
  const router = useRouter()
  const params = useSearchParams()

  const urlConfId       = params.get('conferenceId') || ''
  const urlConfName     = params.get('conferenceName') || ''
  const urlCompany      = params.get('company') || ''
  const urlJobTitle     = params.get('jobTitle') || ''
  const urlFirstName    = params.get('firstName') || ''
  const urlLastName     = params.get('lastName') || ''
  const urlLinkedinUrl  = params.get('linkedinUrl') || ''

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: urlFirstName, lastName: urlLastName, email: '', phone: '',
    company: urlCompany,
    jobTitle: urlJobTitle,
    linkedinUrl: urlLinkedinUrl, notes: '',
  })
  const [ocrRunning, setOcrRunning] = useState(false)
  const [rawText, setRawText] = useState('')
  const [relationshipMatch, setRelationshipMatch] = useState<LeadMatch | null>(null)
  const [otherMatches, setOtherMatches] = useState<LeadMatch[]>([])
  const [mergeLeadId, setMergeLeadId] = useState<string | null>(null)
  const [nameConflictMatch, setNameConflictMatch] = useState<NameMatchResult | null>(null)
  const [preservePreviousEmployment, setPreservePreviousEmployment] = useState(false)
  const [allLeads, setAllLeads] = useState<LeadMatch[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const identityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Conference ──────────────────────────────────────────────────────────────
  const [allConferences, setAllConferences] = useState<ConferenceItem[]>([])
  const [selectedConference, setSelectedConference] = useState<{ id: string; name: string } | null>(
    urlConfId ? { id: urlConfId, name: urlConfName } : null
  )
  const [confQuery, setConfQuery] = useState(urlConfName)
  const [showConfDropdown, setShowConfDropdown] = useState(false)
  const confRef = useRef<HTMLDivElement>(null)

  // ── Company ─────────────────────────────────────────────────────────────────
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)

  // ── Role ────────────────────────────────────────────────────────────────────
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)

  // ── Person suggestion ──────────────────────────────────────────────────────
  const [personSuggestion, setPersonSuggestion] = useState<{
    firstName: string | null; lastName: string | null
    email: string | null; phone: string | null
    confidence: string; reasoning: string; linkedinHint: string | null
    previousContext: string | null; warmth: string | null
    needsReview?: boolean; sourceUrl?: string | null; source?: string
    profileChanges?: string[] | null
  } | null>(null)
  const [loadingPersonSuggestion, setLoadingPersonSuggestion] = useState(false)
  const [personSuggestionDismissed, setPersonSuggestionDismissed] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/leads?all=1').then(r => r.json()).then(d => setAllLeads(d.leads || []))
    fetch('/api/conferences').then(r => r.json()).then(d => setAllConferences(d.conferences || []))
    if (!urlConfId) {
      fetch('/api/users/current-conference').then(r => r.json()).then(d => {
        if (d.conference) {
          setSelectedConference(d.conference)
          setConfQuery(d.conference.name)
        }
      })
    }
  }, [])

  // Fire person suggestion whenever company + role are both set.
  // Pass current firstName/lastName so the route looks up that specific person
  // instead of doing a generic company+role search that could surface someone different.
  useEffect(() => {
    if (!form.company || !form.jobTitle || personSuggestionDismissed) return
    setPersonSuggestion(null)
    fetchPersonSuggestion(form.company, form.jobTitle, form.firstName || undefined, form.lastName || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company, form.jobTitle])

  // Close dropdowns on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (confRef.current    && !confRef.current.contains(e.target as Node))    setShowConfDropdown(false)
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setShowCompanyDropdown(false)
      if (roleRef.current    && !roleRef.current.contains(e.target as Node))    setShowRoleDropdown(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── Conference helpers ──────────────────────────────────────────────────────
  const filteredConferences = allConferences
    .filter(c => {
      if (!confQuery.trim()) return true
      const q = confQuery.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const now = Date.now()
      const aFuture = new Date(a.startDate).getTime() >= now
      const bFuture = new Date(b.startDate).getTime() >= now
      if (aFuture && !bFuture) return -1
      if (!aFuture && bFuture) return 1
      if (aFuture) return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })

  function selectConference(c: ConferenceItem) {
    setSelectedConference({ id: c.id, name: c.name })
    setConfQuery(c.name)
    setShowConfDropdown(false)
  }

  // ── Company helpers ─────────────────────────────────────────────────────────
  async function fetchCompanySuggestions(q: string) {
    const url = `/api/leads/companies?q=${encodeURIComponent(q)}${selectedConference?.id ? `&conferenceId=${selectedConference.id}` : ''}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setCompanySuggestions(data.companies || [])
      setShowCompanyDropdown(true)
    } catch {
      setCompanySuggestions([])
    }
  }

  // ── Role helpers ────────────────────────────────────────────────────────────
  const filteredRoles = form.jobTitle
    ? JOB_TITLE_CHIPS.filter(c => c.toLowerCase().includes(form.jobTitle.toLowerCase()))
    : JOB_TITLE_CHIPS

  // ── Form update ─────────────────────────────────────────────────────────────
  // Identity checking is in the useEffect below — runs on any name/company/email change.
  function updateForm(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'company' || k === 'jobTitle') {
      setPersonSuggestion(null)
      setPersonSuggestionDismissed(false)
    }
  }

  // ── Identity check ───────────────────────────────────────────────────────────
  // Fires whenever name, company, email, or LinkedIn changes — regardless of how
  // the fields were populated (typed, URL param, suggestion accept, OCR scan).
  useEffect(() => {
    if (identityTimerRef.current) clearTimeout(identityTimerRef.current)

    if (allLeads.length === 0) {
      if (!form.firstName || !form.lastName) {
        setNameConflictMatch(null); setRelationshipMatch(null)
        setMergeLeadId(null); setOtherMatches([])
      }
      return
    }

    identityTimerRef.current = setTimeout(() => {
      // ── Definitive signals (exact identifiers) — checked before name guard ──
      if (form.email) {
        const m = allLeads.find(l => l.email?.toLowerCase() === form.email.toLowerCase())
        if (m) {
          setNameConflictMatch(null)
          setRelationshipMatch(m); setMergeLeadId(m.id); setOtherMatches([])
          return
        }
      }
      if (form.phone) {
        const normPhone = (p: string) => p.replace(/[\s\-().+]/g, '')
        const m = allLeads.find(l => l.phone && normPhone(l.phone) === normPhone(form.phone))
        if (m) {
          setNameConflictMatch(null)
          setRelationshipMatch(m); setMergeLeadId(m.id); setOtherMatches([])
          return
        }
      }
      if (form.linkedinUrl) {
        const normLI = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
        const m = allLeads.find(l => l.linkedinUrl && normLI(l.linkedinUrl) === normLI(form.linkedinUrl))
        if (m) {
          setNameConflictMatch(null)
          setRelationshipMatch(m); setMergeLeadId(m.id); setOtherMatches([])
          return
        }
      }

      // ── No exact match — fuzzy name matching requires both names ──
      if (!form.firstName || !form.lastName) {
        setNameConflictMatch(null); setRelationshipMatch(null)
        setMergeLeadId(null); setOtherMatches([])
        return
      }

      const matches = findNameMatches(form.firstName, form.lastName, allLeads)
      const top = matches[0]

      if (!top || top.score < 0.70) {
        setNameConflictMatch(null); setRelationshipMatch(null); setMergeLeadId(null)
        setOtherMatches(matches.slice(0, 3).map(m => m.lead))
        return
      }

      const stored = top.lead
      const norm = (s: string) => s?.toLowerCase().trim() ?? ''
      const companySimilar =
        !form.company || !stored.company ||
        norm(stored.company).includes(norm(form.company)) ||
        norm(form.company).includes(norm(stored.company))

      // Only auto-confirm as warm contact if: exact/nickname name AND same company
      if (top.score >= 0.90 && companySimilar) {
        setNameConflictMatch(null)
        if (stored.conferences.length > 0) {
          setRelationshipMatch(stored); setMergeLeadId(stored.id)
          setOtherMatches(matches.slice(1, 3).map(m => m.lead))
        } else {
          setRelationshipMatch(null); setMergeLeadId(null)
          setOtherMatches(matches.slice(0, 3).map(m => m.lead))
        }
      } else {
        // Nickname, initial, reversed, fuzzy, or different company → always ask
        setNameConflictMatch(top)
        setRelationshipMatch(null); setMergeLeadId(null); setOtherMatches([])
      }
    }, 300)

    return () => { if (identityTimerRef.current) clearTimeout(identityTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.firstName, form.lastName, form.company, form.email, form.linkedinUrl, allLeads])

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
    const parts = (lines[0] || '').split(' ')
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

  async function fetchPersonSuggestion(company: string, jobTitle: string, hintFirstName?: string, hintLastName?: string) {
    if (!company || !jobTitle) return
    setLoadingPersonSuggestion(true)
    setPersonSuggestion(null)
    try {
      const res = await fetch('/api/leads/suggest-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          jobTitle,
          conferenceName: selectedConference?.name,
          conferenceId:   selectedConference?.id,
          firstName:      hintFirstName || undefined,
          lastName:       hintLastName  || undefined,
        }),
      })
      const data = await res.json()
      if (data.person) setPersonSuggestion({
        ...data.person,
        source: data.source,
        needsReview: data.person.needsReview ?? (data.source === 'ai'),
        sourceUrl: data.person.sourceUrl ?? null,
      })
    } catch { /* silently fail */ }
    finally { setLoadingPersonSuggestion(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.company) {
      setError('First name, last name, and company are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, rawCardText: rawText, conferenceId: selectedConference?.id, mergeLeadId, preservePreviousEmployment }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to save lead')
      setSaving(false)
    }
  }

  if (saving) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-content-muted">Saving lead…</p>
      </div>
    </div>
  )

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const confIsUpcoming = (c: ConferenceItem) => new Date(c.startDate).getTime() >= Date.now()

  return (
    <div className="p-6 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.back()} className="text-content-muted hover:text-content-primary text-lg">←</button>
        <h1 className="text-xl font-bold">Add Lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ══ Conference ════════════════════════════════════════ */}
        <div>
          <SectionHeader>Conference</SectionHeader>
          <div className="card space-y-3">
            <div ref={confRef} className="relative">
              <label htmlFor="cap-conference" className="sr-only">Conference</label>
              <input
                id="cap-conference"
                className="input w-full"
                placeholder="Search or type a conference name…"
                autoComplete="off"
                value={confQuery}
                onChange={e => {
                  setConfQuery(e.target.value)
                  setSelectedConference(e.target.value ? { id: '', name: e.target.value } : null)
                  setShowConfDropdown(true)
                }}
                onFocus={() => setShowConfDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!selectedConference && confQuery) setSelectedConference({ id: '', name: confQuery })
                    setShowConfDropdown(false)
                  }
                }}
              />
              {showConfDropdown && filteredConferences.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-surface-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {filteredConferences.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors border-b border-surface-border last:border-0 ${
                          selectedConference?.id === c.id ? 'bg-brand-navy/5' : ''
                        }`}
                        onMouseDown={e => { e.preventDefault(); selectConference(c) }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-content-primary truncate">{c.name}</p>
                            <p className="text-xs text-content-muted">{c.city} · {fmtDate(c.startDate)}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                            confIsUpcoming(c) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {confIsUpcoming(c) ? 'upcoming' : 'past'}
                          </span>
                          {selectedConference?.id === c.id && <span className="text-emerald-500 flex-shrink-0">✓</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedConference?.name && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <span className="text-emerald-500">✓</span>
                <span className="font-medium text-emerald-800 flex-1 truncate">{selectedConference.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedConference(null); setConfQuery('') }}
                  className="text-xs text-content-muted hover:text-red-500 transition-colors"
                >
                  Change
                </button>
              </div>
            )}

            {!selectedConference && (
              <p className="text-xs text-content-muted">
                No conference selected.{' '}
                <button
                  type="button"
                  className="underline hover:text-content-primary"
                  onClick={() => setSelectedConference({ id: '', name: '' })}
                >
                  Skip
                </button>
              </p>
            )}
          </div>
        </div>

        {/* ══ Company ═══════════════════════════════════════════ */}
        <div>
          <SectionHeader>Company</SectionHeader>
          <div className="card">
            <div ref={companyRef} className="relative">
              <label htmlFor="cap-company" className="sr-only">Company</label>
              <input
                id="cap-company"
                className="input w-full"
                placeholder="e.g. Amadeus IT Group"
                autoComplete="off"
                value={form.company}
                onChange={e => {
                  updateForm('company', e.target.value)
                  fetchCompanySuggestions(e.target.value)
                }}
                onFocus={() => fetchCompanySuggestions(form.company)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); setShowCompanyDropdown(false) }
                }}
              />
              {showCompanyDropdown && companySuggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-surface-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {companySuggestions.map((c, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface-raised transition-colors border-b border-surface-border last:border-0"
                        onMouseDown={e => {
                          e.preventDefault()
                          updateForm('company', c)
                          setShowCompanyDropdown(false)
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
        </div>

        {/* ══ Role ══════════════════════════════════════════════ */}
        <div>
          <SectionHeader>Role</SectionHeader>
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-1.5">
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
            <div ref={roleRef} className="relative">
              <label htmlFor="cap-jobtitle" className="sr-only">Job title</label>
              <input
                id="cap-jobtitle"
                className="input w-full"
                placeholder="Or type a custom role…"
                autoComplete="off"
                value={form.jobTitle}
                onChange={e => {
                  updateForm('jobTitle', e.target.value)
                  setShowRoleDropdown(!!e.target.value)
                }}
                onFocus={() => setShowRoleDropdown(!!form.jobTitle)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); setShowRoleDropdown(false) }
                }}
              />
              {showRoleDropdown && filteredRoles.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-surface-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredRoles.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface-raised transition-colors border-b border-surface-border last:border-0"
                        onMouseDown={e => {
                          e.preventDefault()
                          updateForm('jobTitle', r)
                          setShowRoleDropdown(false)
                        }}
                      >
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ══ Person Enrichment ════════════════════════════════ */}
        {form.company && form.jobTitle && !personSuggestionDismissed && (loadingPersonSuggestion || (personSuggestion && personSuggestion.firstName)) && (
          <div>
            <SectionHeader>Person Enrichment</SectionHeader>
            <div
              className={`rounded-xl border overflow-hidden ${
                personSuggestion?.source === 'internal' || personSuggestion?.source === 'target_account'
                  ? 'border-amber-300 bg-amber-50'
                  : personSuggestion?.needsReview
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-brand-navy/20 bg-brand-navy/5'
              }`}
              data-testid="person-suggestion-card"
            >
              {loadingPersonSuggestion ? (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-content-muted">
                  <div className="w-3.5 h-3.5 border border-brand-navy/40 border-t-transparent rounded-full animate-spin" />
                  Searching LinkedIn and your history…
                </div>
              ) : personSuggestion && personSuggestion.firstName ? (
                <>
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
                        {personSuggestion.source === 'internal'      ? 'You\'ve met this person before' :
                         personSuggestion.source === 'target_account' ? 'Known target contact' :
                         personSuggestion.source === 'web_search'    ? 'Found via public search' :
                         'AI estimate — needs review'}
                      </p>
                      <div className="flex items-center gap-1 ml-auto">
                        {personSuggestion.needsReview && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            Needs Review
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          personSuggestion.source === 'internal'       ? 'bg-amber-100 text-amber-700' :
                          personSuggestion.source === 'target_account' ? 'bg-blue-100 text-blue-700' :
                          personSuggestion.confidence === 'high'       ? 'bg-emerald-100 text-emerald-700' :
                          personSuggestion.confidence === 'medium'     ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {personSuggestion.source === 'internal'       ? 'internal' :
                           personSuggestion.source === 'target_account' ? 'target contact' :
                           personSuggestion.source === 'web_search'     ? 'web search' :
                           `AI · ${personSuggestion.confidence}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        personSuggestion.source === 'internal'       ? 'bg-amber-200 text-amber-800' :
                        personSuggestion.source === 'target_account' ? 'bg-blue-200 text-blue-800' :
                        'bg-brand-navy/15 text-brand-navy'
                      }`}>
                        {personSuggestion.firstName[0]}{personSuggestion.lastName?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-content-primary">{personSuggestion.firstName} {personSuggestion.lastName}</p>
                        <p className="text-xs text-content-muted">{form.jobTitle} · {form.company}</p>
                        {personSuggestion.email && (
                          <p className="text-[11px] text-content-secondary mt-0.5">✉ {personSuggestion.email}</p>
                        )}
                        {personSuggestion.phone && (
                          <p className="text-[11px] text-content-secondary mt-0.5">📞 {personSuggestion.phone}</p>
                        )}
                        {personSuggestion.linkedinHint && (
                          <a
                            href={`https://${personSuggestion.linkedinHint.replace(/^https?:\/\//, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline mt-0.5 block truncate"
                          >
                            {personSuggestion.linkedinHint.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                        {personSuggestion.reasoning && (
                          <p className="text-[11px] text-content-muted mt-0.5 italic">{personSuggestion.reasoning}</p>
                        )}
                        {personSuggestion.previousContext && (
                          <p className="text-[11px] text-amber-700 mt-1 font-medium">{personSuggestion.previousContext}</p>
                        )}
                        {personSuggestion.profileChanges && personSuggestion.profileChanges.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-200">
                            <p className="text-[10px] font-bold text-amber-800 mb-0.5">Possible profile change:</p>
                            {personSuggestion.profileChanges.map((c, i) => (
                              <p key={i} className="text-[10px] text-amber-700">· {c}</p>
                            ))}
                          </div>
                        )}
                        {personSuggestion.source === 'ai' && (
                          <p className="text-[10px] text-slate-400 mt-1">AI estimate based on training data — please verify before saving.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 border-t border-brand-navy/10">
                    <button
                      type="button"
                      data-testid="person-suggestion-accept"
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          firstName:  personSuggestion.firstName || f.firstName,
                          lastName:   personSuggestion.lastName  || f.lastName,
                          email:      personSuggestion.email     || f.email,
                          phone:      personSuggestion.phone     || f.phone,
                          linkedinUrl: personSuggestion.linkedinHint
                            ? `https://${personSuggestion.linkedinHint.replace(/^https?:\/\//, '')}`
                            : f.linkedinUrl,
                        }))
                        setPersonSuggestionDismissed(true)
                      }}
                      className="text-xs bg-brand-navy text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-navy/90 transition-colors"
                    >
                      Yes, that's them →
                    </button>
                    <button
                      type="button"
                      data-testid="person-suggestion-dismiss"
                      onClick={() => setPersonSuggestionDismissed(true)}
                      className="text-xs text-content-muted hover:text-content-primary"
                    >
                      Someone else
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ══ Lead Details ══════════════════════════════════════ */}
        <div>
          <SectionHeader>Lead Details</SectionHeader>

          {/* Business card scan */}
          <div
            className="card mb-4 border-dashed border-2 border-surface-border hover:border-brand-accent/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCardScan} />
            <div className="text-center py-2">
              {ocrRunning ? (
                <><div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-content-muted">Scanning card…</p></>
              ) : (
                <><p className="text-2xl mb-1">📷</p>
                  <p className="text-sm text-content-secondary font-medium">Scan Business Card</p>
                  <p className="text-xs text-content-muted">Auto-fills form from photo</p></>
              )}
            </div>
          </div>

          {/* Name conflict — same name, different company/role */}
          {nameConflictMatch && (() => {
            const stored  = nameConflictMatch.lead
            const isJobChange =
              nameConflictMatch.score >= 0.90 &&
              !!form.company && !!stored.company &&
              form.company.toLowerCase().trim() !== stored.company.toLowerCase().trim()

            function confirmSamePerson(profileUpdate: boolean) {
              setMergeLeadId(stored.id)
              setPreservePreviousEmployment(profileUpdate)
              setForm(f => ({
                ...f,
                email:       stored.email       || f.email,
                phone:       stored.phone       || f.phone,
                linkedinUrl: stored.linkedinUrl || f.linkedinUrl,
              }))
              setPersonSuggestion(null)
              setPersonSuggestionDismissed(true)
              setNameConflictMatch(null)
            }

            function dismissConflict() {
              setMergeLeadId(null)
              setPreservePreviousEmployment(false)
              setNameConflictMatch(null)
            }

            return (
              <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-sm font-bold text-amber-800 flex-shrink-0">
                      {stored.firstName[0]}{stored.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-semibold text-sm text-amber-900">
                          {isJobChange ? 'Possible job change detected' : 'Possible duplicate found'}
                        </p>
                        {stored.icpScore !== null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stored.icpScore >= 80 ? 'bg-emerald-100 text-emerald-700' : stored.icpScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {stored.icpScore >= 80 ? 'A' : stored.icpScore >= 60 ? 'B' : 'C'} · {Math.round(stored.icpScore)}
                          </span>
                        )}
                        {stored.hubspotContactId && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">HubSpot ✓</span>
                        )}
                        {!isJobChange && (
                          <span className="text-[10px] text-amber-500 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded capitalize">
                            {nameConflictMatch.matchType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-700 italic mb-1">
                        {isJobChange
                          ? `${stored.firstName} ${stored.lastName} was previously recorded at ${stored.company}`
                          : MATCH_DESCRIPTION[nameConflictMatch.matchType](
                              `${form.firstName} ${form.lastName}`,
                              `${stored.firstName} ${stored.lastName}`,
                            )}
                      </p>
                      <p className="text-xs text-amber-800">
                        Stored as <strong>{stored.jobTitle || 'unknown role'}</strong> at <strong>{stored.company}</strong>
                      </p>
                      {stored.previousCompany && (
                        <p className="text-xs text-amber-600 mt-0.5 italic">
                          Previously: {stored.previousCompany}{stored.previousJobTitle ? ` · ${stored.previousJobTitle}` : ''}
                        </p>
                      )}
                      {stored.conferences.length > 0 && (
                        <p className="text-xs text-amber-700 mt-0.5">
                          Met {stored.conferences.length}× · last at <strong>{stored.conferences[0].conference.name}</strong>
                        </p>
                      )}
                      {stored.email && (
                        <p className="text-xs text-amber-600 mt-0.5">✉ {stored.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/70 rounded-lg px-3 py-2 text-xs border border-amber-200">
                    {isJobChange ? (
                      <>
                        <p className="text-amber-800 font-medium mb-0.5">New entry:</p>
                        <p className="text-amber-700">
                          {[form.jobTitle, form.company].filter(Boolean).join(' at ') || 'no company/role yet'}
                        </p>
                        <p className="text-amber-600 mt-1">Did they change jobs, or is this a different person?</p>
                      </>
                    ) : (
                      <>
                        <p className="text-amber-800">
                          <strong>Current entry:</strong>{' '}
                          {[form.jobTitle, form.company].filter(Boolean).join(' at ') || 'no company/role yet'}
                        </p>
                        <p className="text-amber-600 mt-0.5">Is this the same person, or a different contact?</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-amber-100/60 border-t border-amber-200">
                  {isJobChange ? (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmSamePerson(true)}
                        className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
                      >
                        Yes, update this contact
                      </button>
                      <button
                        type="button"
                        onClick={dismissConflict}
                        className="text-xs bg-white text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-50 transition-colors"
                      >
                        No, different person
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameConflictMatch(null)}
                        className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                      >
                        Unsure, review later
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmSamePerson(false)}
                        className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
                      >
                        Yes, same person
                      </button>
                      <button
                        type="button"
                        onClick={dismissConflict}
                        className="text-xs bg-white text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-50 transition-colors"
                      >
                        No, create new contact
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameConflictMatch(null)}
                        className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                      >
                        Review later
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Relationship context */}
          {relationshipMatch && (
            <div className="mb-4">
              <RelationshipContext match={relationshipMatch} />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMergeLeadId(relationshipMatch.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${mergeLeadId === relationshipMatch.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy'}`}
                >
                  {mergeLeadId === relationshipMatch.id ? '✓ Add to their history' : 'Add to their history'}
                </button>
                <button type="button" onClick={() => { setMergeLeadId(null); setRelationshipMatch(null) }} className="text-xs text-content-muted hover:text-content-primary">
                  Create new contact instead
                </button>
              </div>
            </div>
          )}

          {/* Similar contacts */}
          {!relationshipMatch && otherMatches.length > 0 && (
            <div className="mb-4 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted px-3 pt-2.5 pb-1">Similar contacts</p>
              {otherMatches.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMergeLeadId(mergeLeadId === m.id ? null : m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-t border-surface-border first:border-0 hover:bg-surface-raised/80 ${mergeLeadId === m.id ? 'bg-brand-navy/5 border-l-2 border-l-brand-navy' : ''}`}
                >
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

          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cap-firstName" className="label">First name *</label>
                <input id="cap-firstName" className="input" value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} />
              </div>
              <div>
                <label htmlFor="cap-lastName" className="label">Last name *</label>
                <input id="cap-lastName" className="input" value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="cap-email" className="label">Email</label>
              <input id="cap-email" className="input" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} />
            </div>
            <div>
              <label htmlFor="cap-phone" className="label">Phone</label>
              <input id="cap-phone" className="input" type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
            </div>
            <div>
              <label htmlFor="cap-linkedin" className="label">LinkedIn URL</label>
              <input id="cap-linkedin" className="input" value={form.linkedinUrl} onChange={e => updateForm('linkedinUrl', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ══ Notes & Follow-up ════════════════════════════════ */}
        <div>
          <SectionHeader>Notes & Follow-up</SectionHeader>
          <div className="card">
            <label htmlFor="cap-notes" className="label">Notes</label>
            <textarea
              id="cap-notes"
              className="input resize-none"
              rows={3}
              value={form.notes}
              onChange={e => updateForm('notes', e.target.value)}
              placeholder="What did you talk about?"
            />
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

        <button type="submit" className="btn-primary w-full flex justify-center text-base py-3">Save Lead</button>

      </form>
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense>
      <CapturePageContent />
    </Suspense>
  )
}
