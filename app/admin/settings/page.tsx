'use client'
import { useEffect, useState } from 'react'

type TestStatus = 'idle' | 'testing' | 'connected' | 'invalid_key' | 'network_error' | 'timeout' | 'no_key' | 'failed'

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null)
  const [aiKey, setAiKey] = useState('')
  const [hubspotMode, setHubspotMode] = useState('MOCK')
  const [hubspotKey, setHubspotKey] = useState('')
  const [serperKey, setSerperKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      setConfig(d)
      setHubspotMode(d.hubspotMode || 'MOCK')
    })
  }, [])

  // Reset test status when mode or key changes
  useEffect(() => { setTestStatus('idle'); setTestMessage('') }, [hubspotMode, hubspotKey])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false)
    const body: any = { aiProvider: 'ANTHROPIC', hubspotMode }
    if (aiKey) body.aiApiKey = aiKey
    if (hubspotKey) body.hubspotApiKey = hubspotKey
    if (serperKey) body.serperApiKey = serperKey
    await fetch('/api/admin/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false); setSaved(true)
    setAiKey(''); setHubspotKey(''); setSerperKey('')
    fetch('/api/admin/config').then(r => r.json()).then(setConfig)
  }

  async function testConnection() {
    setTestStatus('testing'); setTestMessage('')
    const body: any = {}
    if (hubspotKey) body.apiKey = hubspotKey
    const res = await fetch('/api/admin/hubspot-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setTestStatus(data.connected ? 'connected' : (data.error as TestStatus) || 'failed')
    setTestMessage(data.message || '')
  }

  function hubspotStatusUI() {
    if (hubspotMode === 'MOCK') {
      return {
        dot:   'bg-amber-400',
        bg:    'bg-amber-50 border-amber-200',
        label: 'Mock mode active',
        sub:   'No real HubSpot calls are made. Leads are logged locally only.',
      }
    }
    if (testStatus === 'connected') {
      return {
        dot:   'bg-emerald-500',
        bg:    'bg-emerald-50 border-emerald-200',
        label: 'Connected to HubSpot',
        sub:   testMessage,
      }
    }
    if (testStatus === 'invalid_key') {
      return {
        dot:   'bg-red-500',
        bg:    'bg-red-50 border-red-200',
        label: 'Invalid API key',
        sub:   testMessage,
      }
    }
    if (testStatus === 'network_error' || testStatus === 'timeout' || testStatus === 'failed') {
      return {
        dot:   'bg-red-400',
        bg:    'bg-red-50 border-red-200',
        label: testStatus === 'timeout' ? 'Connection timed out' : 'Connection failed',
        sub:   testMessage,
      }
    }
    if (testStatus === 'no_key' || (!config?.hubspotApiKeySet && !hubspotKey)) {
      return {
        dot:   'bg-slate-400',
        bg:    'bg-surface-raised border-surface-border',
        label: 'Not connected',
        sub:   'Enter a HubSpot API key and save, then test the connection.',
      }
    }
    // key is configured but not yet tested
    return {
      dot:   'bg-slate-400',
      bg:    'bg-surface-raised border-surface-border',
      label: config?.hubspotApiKeySet || hubspotKey ? 'API key configured — not yet tested' : 'Not connected',
      sub:   'Click "Test Connection" to verify.',
    }
  }

  const status = hubspotStatusUI()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-content-muted text-sm mt-1">Admin-only · AI and HubSpot configuration</p>
      </div>

      {saved && (
        <div className="p-3 bg-green-900/30 border border-green-700/40 rounded-lg text-green-400 text-sm">
          Settings saved ✓
        </div>
      )}

      <form onSubmit={save} className="space-y-6">

        {/* ── AI Config ─────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-brand-accent">AI Configuration</h2>
          <div>
            <label className="label">Anthropic API Key</label>
            <input
              className="input" type="password"
              placeholder={config?.aiApiKeySet ? '••••••••••••• (set — enter new to replace)' : 'Enter API key…'}
              value={aiKey} onChange={e => setAiKey(e.target.value)}
            />
            <p className="text-xs text-content-muted mt-1">
              Used for ICP scoring, follow-up drafts, and conference discovery.
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
            <div className={`w-2 h-2 rounded-full ${config?.aiApiKeySet ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm text-content-secondary">
              {config?.aiApiKeySet ? 'AI key configured — features active' : 'No AI key set — rule-based fallback only'}
            </span>
          </div>
        </div>

        {/* ── Web Search ────────────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-brand-accent">Web Search Enrichment</h2>
          <p className="text-xs text-content-muted">
            Finds real people by searching LinkedIn via Google (Serper). Without this, person enrichment uses AI estimates only.
          </p>
          <div>
            <label className="label">Serper API Key</label>
            <input
              className="input" type="password"
              placeholder={config?.serperApiKeySet ? '••••••••••••• (set — enter new to replace)' : 'Enter API key…'}
              value={serperKey} onChange={e => setSerperKey(e.target.value)}
            />
            <p className="text-xs text-content-muted mt-1">
              Free key at serper.dev — 2,500 searches, no card required.
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
            <div className={`w-2 h-2 rounded-full ${config?.serperApiKeySet ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm text-content-secondary">
              {config?.serperApiKeySet
                ? 'Web search active — person enrichment uses real Google/LinkedIn data'
                : 'No search key — falling back to AI estimates'}
            </span>
          </div>
        </div>

        {/* ── HubSpot Integration ───────────────────────── */}
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-brand-accent">HubSpot Integration</h2>
            <p className="text-xs text-content-muted mt-0.5">
              Choose how leads are handed off to HubSpot after capture and review.
            </p>
          </div>

          {/* Mode selection — two cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHubspotMode('MOCK')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                hubspotMode === 'MOCK'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-surface-border bg-white hover:border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🟡</span>
                <span className="font-semibold text-sm text-amber-900">Mock Mode</span>
                {hubspotMode === 'MOCK' && (
                  <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">Active</span>
                )}
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">
                Leads are <strong>logged locally only</strong>. No real HubSpot API calls are made. Safe for demos and testing.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setHubspotMode('REAL')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                hubspotMode === 'REAL'
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-surface-border bg-white hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🟢</span>
                <span className="font-semibold text-sm text-emerald-900">Real HubSpot API</span>
                {hubspotMode === 'REAL' && (
                  <span className="ml-auto text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-medium">Active</span>
                )}
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">
                Leads are <strong>pushed to HubSpot</strong> using your Private App access token. Used for production.
              </p>
            </button>
          </div>

          {/* API key field — only for REAL mode */}
          {hubspotMode === 'REAL' && (
            <div>
              <label className="label">HubSpot Private App Access Token</label>
              <input
                className="input font-mono text-sm"
                type="password"
                placeholder={config?.hubspotApiKeySet ? '•••••••••••••••• (saved — enter new to replace)' : 'pat-na1-…'}
                value={hubspotKey}
                onChange={e => setHubspotKey(e.target.value)}
              />
              <p className="text-xs text-content-muted mt-1">
                In HubSpot: Settings → Integrations → Private Apps → Create a private app.
                Requires <code className="bg-surface-raised px-1 rounded">crm.objects.contacts.write</code> scope.
              </p>
            </div>
          )}

          {/* Connection status + Test button */}
          <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${status.bg}`}>
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-content-primary">{status.label}</p>
              {status.sub && <p className="text-xs text-content-secondary mt-0.5">{status.sub}</p>}
            </div>
            {hubspotMode === 'REAL' && (
              <button
                type="button"
                onClick={testConnection}
                disabled={testStatus === 'testing'}
                className="flex-shrink-0 text-xs bg-white border border-surface-border px-3 py-1.5 rounded-lg font-medium hover:bg-surface-raised transition-colors disabled:opacity-50"
              >
                {testStatus === 'testing' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-content-muted border-t-transparent rounded-full animate-spin" />
                    Testing…
                  </span>
                ) : 'Test Connection'}
              </button>
            )}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex justify-center">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
