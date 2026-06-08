'use client'
import { useEffect, useState } from 'react'

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null)
  const [aiKey, setAiKey] = useState('')
  const [aiProvider, setAiProvider] = useState('OPENAI')
  const [hubspotMode, setHubspotMode] = useState('MOCK')
  const [hubspotKey, setHubspotKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      setConfig(d); setAiProvider(d.aiProvider || 'OPENAI'); setHubspotMode(d.hubspotMode || 'MOCK')
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaved(false)
    const body: any = { aiProvider, hubspotMode }
    if (aiKey) body.aiApiKey = aiKey
    if (hubspotKey) body.hubspotApiKey = hubspotKey
    await fetch('/api/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false); setSaved(true); setAiKey(''); setHubspotKey('')
    fetch('/api/admin/config').then(r => r.json()).then(setConfig)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-content-muted text-sm mt-1">Admin-only · AI and HubSpot configuration</p>
      </div>

      {saved && <div className="p-3 bg-green-900/30 border border-green-700/40 rounded-lg text-green-400 text-sm">Settings saved ✓</div>}

      <form onSubmit={save} className="space-y-6">
        {/* AI Config */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-brand-accent">AI Configuration</h2>
          <div>
            <label className="label">Provider</label>
            <select className="input" value={aiProvider} onChange={e => setAiProvider(e.target.value)}>
              <option value="OPENAI">OpenAI (GPT-4o mini)</option>
              <option value="ANTHROPIC">Anthropic (Claude Haiku)</option>
            </select>
          </div>
          <div>
            <label className="label">API Key</label>
            <input className="input" type="password" placeholder={config?.aiApiKeySet ? '••••••••••••• (set — enter new to replace)' : 'Enter API key…'} value={aiKey} onChange={e => setAiKey(e.target.value)} />
            <p className="text-xs text-content-muted mt-1">Stored securely. Used for ICP scoring, follow-up drafts, and conference discovery.</p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
            <div className={`w-2 h-2 rounded-full ${config?.aiApiKeySet ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm text-content-secondary">{config?.aiApiKeySet ? 'AI key configured — features active' : 'No AI key set — rule-based fallback only'}</span>
          </div>
        </div>

        {/* HubSpot Config */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-brand-accent">HubSpot Integration</h2>
          <div>
            <label className="label">Mode</label>
            <div className="flex gap-3">
              {['MOCK', 'REAL'].map(m => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hubspotMode" value={m} checked={hubspotMode === m} onChange={() => setHubspotMode(m)} className="accent-brand-accent" />
                  <span className="text-sm">{m === 'MOCK' ? '🟡 Mock (demo mode)' : '🟢 Real HubSpot API'}</span>
                </label>
              ))}
            </div>
          </div>
          {hubspotMode === 'REAL' && (
            <div>
              <label className="label">HubSpot Private API Key</label>
              <input className="input" type="password" placeholder={config?.hubspotApiKeySet ? '•••••••••••• (set)' : 'pat-na1-…'} value={hubspotKey} onChange={e => setHubspotKey(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-surface-raised rounded-lg">
            <div className={`w-2 h-2 rounded-full ${hubspotMode === 'MOCK' ? 'bg-yellow-400' : config?.hubspotApiKeySet ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-content-secondary">
              {hubspotMode === 'MOCK' ? 'Mock mode — leads logged locally, no HubSpot calls' : config?.hubspotApiKeySet ? 'Live mode — syncing to real HubSpot' : 'Real mode selected but no key set'}
            </span>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex justify-center">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
