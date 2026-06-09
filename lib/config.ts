import { db } from './db'

export interface SystemConfig {
  aiProvider: string
  aiApiKey: string | null
  hubspotMode: string
  hubspotApiKey: string | null
  serperApiKey: string | null
}

function fromEnv(): Partial<SystemConfig> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null
  const openaiKey    = process.env.OPENAI_API_KEY    || null
  const hubspotKey   = process.env.HUBSPOT_API_KEY   || null
  const serperKey    = process.env.SERPER_API_KEY     || null

  return {
    aiProvider:    anthropicKey ? 'ANTHROPIC' : 'OPENAI',
    aiApiKey:      anthropicKey || openaiKey  || null,
    hubspotMode:   hubspotKey   ? 'REAL'      : 'MOCK',
    hubspotApiKey: hubspotKey,
    serperApiKey:  serperKey,
  }
}

export async function getConfig(): Promise<SystemConfig> {
  let cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })

  if (!cfg) {
    const env = fromEnv()
    cfg = await db.systemConfig.create({
      data: {
        id:            'singleton',
        aiProvider:    env.aiProvider    ?? 'OPENAI',
        aiApiKey:      env.aiApiKey      ?? null,
        hubspotMode:   env.hubspotMode   ?? 'MOCK',
        hubspotApiKey: env.hubspotApiKey ?? null,
        serperApiKey:  env.serperApiKey  ?? null,
      },
    })
  } else {
    // Fill any null fields with env var values without overwriting explicit DB settings
    const env = fromEnv()
    const patch: Partial<SystemConfig> = {}
    if (!cfg.aiApiKey      && env.aiApiKey)      patch.aiApiKey      = env.aiApiKey
    if (!cfg.hubspotApiKey && env.hubspotApiKey) patch.hubspotApiKey = env.hubspotApiKey
    if (!cfg.serperApiKey  && env.serperApiKey)  patch.serperApiKey  = env.serperApiKey
    if (Object.keys(patch).length) {
      cfg = await db.systemConfig.update({ where: { id: 'singleton' }, data: patch })
    }
  }

  return {
    aiProvider:    cfg.aiProvider,
    aiApiKey:      cfg.aiApiKey      ?? null,
    hubspotMode:   cfg.hubspotMode,
    hubspotApiKey: cfg.hubspotApiKey ?? null,
    serperApiKey:  cfg.serperApiKey  ?? null,
  }
}
