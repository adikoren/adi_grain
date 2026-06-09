import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ── Upcoming conferences (2026) ───────────────────────────────────────────────
const upcomingConferences = [
  { name: 'Money20/20 USA', city: 'Las Vegas', country: 'US', lat: 36.1699, lng: -115.1398, startDate: '2026-10-22', endDate: '2026-10-25', verticals: ['PAYMENTS', 'FINTECH'], audience: 13000, icp: 95, website: 'https://us.money2020.com', status: 'ATTENDING' },
  { name: 'Money20/20 Europe', city: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041, startDate: '2026-06-01', endDate: '2026-06-04', verticals: ['PAYMENTS', 'FINTECH'], audience: 8000, icp: 92, website: 'https://europe.money2020.com', status: 'ATTENDING' },
  { name: 'Sibos 2026', city: 'Sydney', country: 'AU', lat: -33.8688, lng: 151.2093, startDate: '2026-10-12', endDate: '2026-10-15', verticals: ['FX', 'PAYMENTS', 'FINTECH'], audience: 10000, icp: 90, website: 'https://sibos.com', status: 'EVALUATING' },
  { name: 'EBAday', city: 'Lisbon', country: 'PT', lat: 38.7223, lng: -9.1393, startDate: '2026-06-09', endDate: '2026-06-10', verticals: ['PAYMENTS', 'FINTECH'], audience: 1200, icp: 88, website: 'https://ebaday.com', status: 'ATTENDING' },
  { name: 'FX Week Europe', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-09-14', endDate: '2026-09-15', verticals: ['FX'], audience: 600, icp: 95, website: 'https://fxweek.com/events', status: 'ATTENDING' },
  { name: 'Currency Research Americas', city: 'Miami', country: 'US', lat: 25.7617, lng: -80.1918, startDate: '2026-03-16', endDate: '2026-03-18', verticals: ['FX'], audience: 400, icp: 92, website: 'https://currencyresearch.com', status: 'EVALUATING' },
  { name: 'Currency Research Banknote Conference', city: 'Lisbon', country: 'PT', lat: 38.7223, lng: -9.1393, startDate: '2026-05-18', endDate: '2026-05-20', verticals: ['FX'], audience: 500, icp: 88, website: 'https://currencyresearch.com', status: 'EVALUATING' },
  { name: 'FX Markets Europe', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-09-10', endDate: '2026-09-11', verticals: ['FX'], audience: 500, icp: 90, website: 'https://fxmarkets.com', status: 'ATTENDING' },
  { name: 'NACHA Payments', city: 'San Diego', country: 'US', lat: 32.7157, lng: -117.1611, startDate: '2026-04-12', endDate: '2026-04-15', verticals: ['PAYMENTS'], audience: 3000, icp: 80, website: 'https://nacha.org/payments', status: 'EVALUATING' },
  { name: 'AFP Annual Conference', city: 'Nashville', country: 'US', lat: 36.1627, lng: -86.7816, startDate: '2026-10-18', endDate: '2026-10-21', verticals: ['FX', 'TREASURY'], audience: 7000, icp: 85, website: 'https://afponline.org', status: 'ATTENDING' },
  { name: 'TMS Summit', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-03-10', endDate: '2026-03-11', verticals: ['FX', 'TREASURY'], audience: 400, icp: 88, website: 'https://tmssummit.com', status: 'ATTENDING' },
  { name: 'Seamless Middle East', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-04-14', endDate: '2026-04-15', verticals: ['PAYMENTS', 'FINTECH'], audience: 5000, icp: 78, website: 'https://seamless-expo.com', status: 'EVALUATING' },
  { name: 'Seamless Asia', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-09-08', endDate: '2026-09-09', verticals: ['PAYMENTS', 'FINTECH'], audience: 4000, icp: 76, website: 'https://seamless-expo.com/asia', status: 'EVALUATING' },
  { name: 'Paris Fintech Forum', city: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522, startDate: '2026-01-27', endDate: '2026-01-28', verticals: ['FINTECH', 'PAYMENTS'], audience: 2500, icp: 80, website: 'https://parisfintechforum.com', status: 'ATTENDING' },
  { name: 'Singapore Fintech Festival', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-11-09', endDate: '2026-11-11', verticals: ['FINTECH', 'PAYMENTS'], audience: 45000, icp: 72, website: 'https://fintechfestival.sg', status: 'EVALUATING' },
  { name: 'SWIFT Business Forum London', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-04-22', endDate: '2026-04-23', verticals: ['FX', 'PAYMENTS'], audience: 800, icp: 87, website: 'https://swift.com/events', status: 'ATTENDING' },
  { name: 'SWIFT Business Forum New York', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-05-07', endDate: '2026-05-07', verticals: ['FX', 'PAYMENTS'], audience: 600, icp: 86, website: 'https://swift.com/events', status: 'EVALUATING' },
  { name: 'EuroFinance International Treasury', city: 'Barcelona', country: 'ES', lat: 41.3851, lng: 2.1734, startDate: '2026-09-23', endDate: '2026-09-25', verticals: ['FX', 'TREASURY'], audience: 3000, icp: 88, website: 'https://eurofinance.com', status: 'ATTENDING' },
  { name: 'Association of Corporate Treasurers (ACT) Annual', city: 'Manchester', country: 'GB', lat: 53.4808, lng: -2.2426, startDate: '2026-05-19', endDate: '2026-05-20', verticals: ['FX', 'TREASURY'], audience: 1200, icp: 85, website: 'https://treasurers.org', status: 'ATTENDING' },
  { name: 'Forex Expo Dubai', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-09-28', endDate: '2026-09-29', verticals: ['FX'], audience: 5000, icp: 80, website: 'https://forexexpo.ae', status: 'EVALUATING' },
  { name: 'FX Week US', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-06-08', endDate: '2026-06-09', verticals: ['FX'], audience: 400, icp: 90, website: 'https://fxweek.com/events', status: 'EVALUATING' },
  { name: 'Phocuswright Conference', city: 'Phoenix', country: 'US', lat: 33.4484, lng: -112.074, startDate: '2026-11-17', endDate: '2026-11-19', verticals: ['TRAVEL'], audience: 1800, icp: 82, website: 'https://phocuswright.com', status: 'EVALUATING' },
  { name: 'FIA Expo', city: 'Chicago', country: 'US', lat: 41.8781, lng: -87.6298, startDate: '2026-11-03', endDate: '2026-11-05', verticals: ['FX', 'FINTECH'], audience: 3500, icp: 78, website: 'https://fia.org/expo', status: 'EVALUATING' },
  { name: 'FX Invest Europe', city: 'Frankfurt', country: 'DE', lat: 50.1109, lng: 8.6821, startDate: '2026-10-19', endDate: '2026-10-20', verticals: ['FX'], audience: 400, icp: 85, website: 'https://fxinvest.com', status: 'ATTENDING' },
]

// ── Past conferences (2024–2025) ──────────────────────────────────────────────
const pastConferences = [
  { name: 'Money20/20 USA 2024', city: 'Las Vegas', country: 'US', lat: 36.1699, lng: -115.1398, startDate: '2024-10-27', endDate: '2024-10-30', verticals: ['PAYMENTS', 'FINTECH'], audience: 13000, icp: 95, website: 'https://us.money2020.com', status: 'ATTENDED' },
  { name: 'EuroFinance 2024', city: 'Copenhagen', country: 'DK', lat: 55.6761, lng: 12.5683, startDate: '2024-09-18', endDate: '2024-09-20', verticals: ['FX', 'TREASURY'], audience: 3000, icp: 88, website: 'https://eurofinance.com', status: 'ATTENDED' },
  { name: 'FX Week Europe 2024', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2024-09-09', endDate: '2024-09-10', verticals: ['FX'], audience: 600, icp: 95, website: 'https://fxweek.com/events', status: 'ATTENDED' },
  { name: 'Sibos 2024', city: 'Beijing', country: 'CN', lat: 39.9042, lng: 116.4074, startDate: '2024-10-21', endDate: '2024-10-24', verticals: ['FX', 'PAYMENTS', 'FINTECH'], audience: 10000, icp: 90, website: 'https://sibos.com', status: 'ATTENDED' },
  { name: 'AFP Annual Conference 2024', city: 'Nashville', country: 'US', lat: 36.1627, lng: -86.7816, startDate: '2024-10-20', endDate: '2024-10-23', verticals: ['FX', 'TREASURY'], audience: 7000, icp: 85, website: 'https://afponline.org', status: 'ATTENDED' },
  { name: 'FinTech Connect 2024', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2024-11-27', endDate: '2024-11-28', verticals: ['FINTECH'], audience: 3000, icp: 73, website: 'https://fintechconnect.com', status: 'ATTENDED' },
  { name: 'Money20/20 Europe 2025', city: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041, startDate: '2025-06-02', endDate: '2025-06-05', verticals: ['PAYMENTS', 'FINTECH'], audience: 8000, icp: 92, website: 'https://europe.money2020.com', status: 'ATTENDED' },
  { name: 'Paris Fintech Forum 2025', city: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522, startDate: '2025-01-28', endDate: '2025-01-29', verticals: ['FINTECH', 'PAYMENTS'], audience: 2500, icp: 80, website: 'https://parisfintechforum.com', status: 'ATTENDED' },
  { name: 'SWIFT Business Forum London 2025', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2025-04-23', endDate: '2025-04-24', verticals: ['FX', 'PAYMENTS'], audience: 800, icp: 87, website: 'https://swift.com/events', status: 'ATTENDED' },
  { name: 'EuroFinance 2025', city: 'Vienna', country: 'AT', lat: 48.2082, lng: 16.3738, startDate: '2025-09-17', endDate: '2025-09-19', verticals: ['FX', 'TREASURY'], audience: 3000, icp: 88, website: 'https://eurofinance.com', status: 'ATTENDED' },
]

async function main() {
  console.log('🌱 Seeding database...')

  // ── Users ─────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin', 10)
  const repHash = await bcrypt.hash('grain123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@grain.internal' },
    update: {},
    create: { email: 'admin@grain.internal', name: 'Admin', passwordHash: hash, role: 'ADMIN', isActive: true },
  })

  const alexKim = await prisma.user.upsert({
    where: { email: 'alex.kim@grain.internal' },
    update: {},
    create: { email: 'alex.kim@grain.internal', name: 'Alex Kim', passwordHash: repHash, role: 'MANAGER', isActive: true },
  })

  const sarahChen = await prisma.user.upsert({
    where: { email: 'sarah.chen@grain.internal' },
    update: {},
    create: { email: 'sarah.chen@grain.internal', name: 'Sarah Chen', passwordHash: repHash, role: 'SALES_PERSON', isActive: true },
  })

  const jakeMartinez = await prisma.user.upsert({
    where: { email: 'jake.martinez@grain.internal' },
    update: {},
    create: { email: 'jake.martinez@grain.internal', name: 'Jake Martinez', passwordHash: repHash, role: 'SALES_PERSON', isActive: true },
  })

  const priyaNair = await prisma.user.upsert({
    where: { email: 'priya.nair@grain.internal' },
    update: {},
    create: { email: 'priya.nair@grain.internal', name: 'Priya Nair', passwordHash: repHash, role: 'SALES_PERSON', isActive: true },
  })

  console.log('✓ Users created (admin / alex.kim / sarah.chen / jake.martinez / priya.nair)')

  // ── System config ─────────────────────────────────────────────────────────
  await prisma.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', aiProvider: 'ANTHROPIC', hubspotMode: 'MOCK' },
  })

  // ── Upcoming conferences ──────────────────────────────────────────────────
  const confMap: Record<string, string> = {}
  for (const c of upcomingConferences) {
    const rec = await prisma.conference.upsert({
      where: { name: c.name } as any,
      update: { icpScore: c.icp, attendingStatus: c.status },
      create: {
        name: c.name, website: c.website,
        startDate: new Date(c.startDate), endDate: new Date(c.endDate),
        city: c.city, country: c.country, lat: c.lat, lng: c.lng,
        verticals: JSON.stringify(c.verticals),
        estimatedAudience: c.audience, icpScore: c.icp,
        status: 'ACTIVE', source: 'SEED',
        attendingStatus: c.status,
      },
    })
    confMap[c.name] = rec.id
  }

  // ── Past conferences ──────────────────────────────────────────────────────
  const pastMap: Record<string, string> = {}
  for (const c of pastConferences) {
    const rec = await prisma.conference.upsert({
      where: { name: c.name } as any,
      update: {},
      create: {
        name: c.name, website: c.website,
        startDate: new Date(c.startDate), endDate: new Date(c.endDate),
        city: c.city, country: c.country, lat: c.lat, lng: c.lng,
        verticals: JSON.stringify(c.verticals),
        estimatedAudience: c.audience, icpScore: c.icp,
        status: 'ATTENDED', source: 'SEED',
        attendingStatus: 'ATTENDED',
        campaignStatus: 'DONE', outboundStatus: 'DONE',
      },
    })
    pastMap[c.name] = rec.id
  }
  console.log(`✓ ${upcomingConferences.length + pastConferences.length} conferences seeded`)

  // ── Target accounts for upcoming conferences ──────────────────────────────
  const targetAccountsData: Array<{ confName: string; company: string; contactName: string; contactRole: string; priority: string; status: string; notes: string }> = [
    // Money20/20 USA
    { confName: 'Money20/20 USA', company: 'Booking.com', contactName: 'Rachel Goldstein', contactRole: 'Head of Treasury', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Manages €2B+ in FX annually. Expressed interest at last year\'s show.' },
    { confName: 'Money20/20 USA', company: 'Airbnb', contactName: 'Marcus Webb', contactRole: 'VP Finance & FX', priority: 'HIGH', status: 'TO_MEET', notes: 'Key decision maker for cross-border payments stack.' },
    { confName: 'Money20/20 USA', company: 'Stripe', contactName: 'Jennifer Patel', contactRole: 'Head of FX Strategy', priority: 'HIGH', status: 'TO_MEET', notes: 'Expanding Stripe Treasury — strong FX pain.' },
    { confName: 'Money20/20 USA', company: 'Nuvei', contactName: 'David Schwartz', contactRole: 'CFO', priority: 'MEDIUM', status: 'TO_MEET', notes: 'High-growth PSP with multi-currency settlement complexity.' },
    { confName: 'Money20/20 USA', company: 'Checkout.com', contactName: 'Sophie Turner', contactRole: 'Head of Payments', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Rebuilding FX hedging strategy post Series D.' },

    // Money20/20 Europe
    { confName: 'Money20/20 Europe', company: 'Adyen', contactName: 'Lars Eriksen', contactRole: 'VP Treasury', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Handles settlements in 40+ currencies. Demo scheduled for June.' },
    { confName: 'Money20/20 Europe', company: 'Revolut', contactName: 'Priya Sharma', contactRole: 'CFO', priority: 'HIGH', status: 'TO_MEET', notes: 'Scaling FX ops rapidly — key ICP target.' },
    { confName: 'Money20/20 Europe', company: 'Wise', contactName: 'Tom Müller', contactRole: 'Head of FX Operations', priority: 'HIGH', status: 'MET', notes: 'Previous relationship from EuroFinance. Ready to see updated demo.' },
    { confName: 'Money20/20 Europe', company: 'Klarna', contactName: 'Anna Lindqvist', contactRole: 'Treasury Director', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Post-IPO treasury transformation underway.' },
    { confName: 'Money20/20 Europe', company: 'N26', contactName: 'Felix Wagner', contactRole: 'Head of Finance', priority: 'MEDIUM', status: 'TO_MEET', notes: 'SMB banking with multi-country FX exposure.' },

    // FX Week Europe
    { confName: 'FX Week Europe', company: 'HSBC', contactName: 'James Whitfield', contactRole: 'Global Head of FX', priority: 'HIGH', status: 'TO_MEET', notes: 'Core ICP — massive FX volumes, potential enterprise deal.' },
    { confName: 'FX Week Europe', company: 'Barclays', contactName: 'Natasha Armstrong', contactRole: 'Director, FX Trading', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Evaluating risk management tools. Strong FX pain.' },
    { confName: 'FX Week Europe', company: 'Deutsche Bank', contactName: 'Karl Becker', contactRole: 'MD, FX Structuring', priority: 'HIGH', status: 'TO_MEET', notes: 'Met at EuroFinance 2024 — follow up on proposal.' },
    { confName: 'FX Week Europe', company: 'Standard Chartered', contactName: 'Mei Lin', contactRole: 'Head of EM FX', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Emerging markets FX — strong alignment with Grain.' },
    { confName: 'FX Week Europe', company: 'BNP Paribas', contactName: 'Pierre Leclerc', contactRole: 'Head of Corporate FX', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Reviewing corporate hedging solutions.' },

    // EuroFinance International Treasury
    { confName: 'EuroFinance International Treasury', company: 'Shell', contactName: 'Catherine Price', contactRole: 'Group Treasurer', priority: 'HIGH', status: 'TO_MEET', notes: '$50B+ FX exposure annually. Tier-1 enterprise target.' },
    { confName: 'EuroFinance International Treasury', company: 'Unilever', contactName: 'Robert Marsh', contactRole: 'VP Treasury', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Consolidating treasury tech stack — active evaluation.' },
    { confName: 'EuroFinance International Treasury', company: 'Siemens', contactName: 'Helga Brandtner', contactRole: 'Head of FX Risk', priority: 'HIGH', status: 'TO_MEET', notes: 'Industrial giant with complex multi-currency hedging.' },
    { confName: 'EuroFinance International Treasury', company: 'Vodafone', contactName: 'Alan Foster', contactRole: 'Group Treasury Director', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Operates in 20+ currencies. Evaluating automation.' },
    { confName: 'EuroFinance International Treasury', company: 'Rolls-Royce', contactName: 'Sarah Blackwood', contactRole: 'Head of Treasury Ops', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Post-restructuring — building new treasury platform.' },

    // AFP Annual Conference
    { confName: 'AFP Annual Conference', company: 'Microsoft', contactName: 'Kevin Zhang', contactRole: 'Director of FX Treasury', priority: 'HIGH', status: 'TO_MEET', notes: 'Cloud revenue in 100+ currencies. Enormous FX exposure.' },
    { confName: 'AFP Annual Conference', company: 'Nike', contactName: 'Lisa Hernandez', contactRole: 'VP Treasury', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Global retailer reviewing FX hedging vendors.' },
    { confName: 'AFP Annual Conference', company: 'Caterpillar', contactName: 'Brian Summers', contactRole: 'Treasurer', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Heavy industrial, multi-currency supply chain FX.' },
    { confName: 'AFP Annual Conference', company: 'HP Inc', contactName: 'Donna Walsh', contactRole: 'Head of Treasury Risk', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Active RFP for treasury management system.' },
    { confName: 'AFP Annual Conference', company: 'Pfizer', contactName: 'James Kelso', contactRole: 'Global Treasurer', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Post-COVID treasury modernisation initiative.' },

    // Sibos 2026
    { confName: 'Sibos 2026', company: 'Westpac', contactName: 'Chris Nguyen', contactRole: 'Head of Transaction Banking', priority: 'HIGH', status: 'TO_MEET', notes: 'Major Australian bank — APAC FX flows.' },
    { confName: 'Sibos 2026', company: 'ANZ', contactName: 'Fiona McLeod', contactRole: 'Head of FX', priority: 'HIGH', status: 'TO_MEET', notes: 'Active in Pacific corridor cross-border payments.' },
    { confName: 'Sibos 2026', company: 'DBS Bank', contactName: 'Wei Chen', contactRole: 'Head of Global Transaction Services', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Singapore-based, strong APAC coverage.' },
    { confName: 'Sibos 2026', company: 'MUFG', contactName: 'Takeshi Yamamoto', contactRole: 'Deputy Head of FX', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Japanese megabank with global FX operations.' },
    { confName: 'Sibos 2026', company: 'ING', contactName: 'Wouter van den Berg', contactRole: 'Head of Payments & Cash', priority: 'LOW', status: 'TO_MEET', notes: 'European bank — strong wholesale banking angle.' },

    // SWIFT Business Forum London
    { confName: 'SWIFT Business Forum London', company: 'Lloyds Banking Group', contactName: 'Emma Clarke', contactRole: 'Head of Correspondent Banking', priority: 'HIGH', status: 'REACHED_OUT', notes: 'Key correspondent banking relationship — FX automation.' },
    { confName: 'SWIFT Business Forum London', company: 'RBS / NatWest', contactName: 'Duncan McPherson', contactRole: 'Head of FX & Rates', priority: 'HIGH', status: 'TO_MEET', notes: 'Post-restructuring — evaluating new FX infrastructure.' },
    { confName: 'SWIFT Business Forum London', company: 'Santander UK', contactName: 'Maria Garcia', contactRole: 'Director, Transaction Banking', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Part of global Santander FX evaluation.' },

    // TMS Summit
    { confName: 'TMS Summit', company: 'Roper Technologies', contactName: 'Greg Nash', contactRole: 'VP Corporate Finance', priority: 'HIGH', status: 'TO_MEET', notes: 'Complex multi-entity treasury structure.' },
    { confName: 'TMS Summit', company: 'Compass Group', contactName: 'Helen Brady', contactRole: 'Group Treasurer', priority: 'HIGH', status: 'TO_MEET', notes: 'Global foodservice — 40+ countries, major FX exposure.' },
    { confName: 'TMS Summit', company: 'Smiths Group', contactName: 'Ian Mackenzie', contactRole: 'Head of Treasury', priority: 'MEDIUM', status: 'TO_MEET', notes: 'Mid-cap industrial reviewing TMS vendors.' },
  ]

  for (const t of targetAccountsData) {
    const confId = confMap[t.confName]
    if (!confId) continue
    const existing = await prisma.targetAccount.findFirst({ where: { conferenceId: confId, company: t.company } })
    if (!existing) {
      await prisma.targetAccount.create({
        data: {
          conferenceId: confId, company: t.company,
          contactName: t.contactName, contactRole: t.contactRole,
          priority: t.priority, status: t.status, notes: t.notes,
        },
      })
    }
  }
  console.log(`✓ ${targetAccountsData.length} target accounts seeded`)

  // ── Leads (repeat contacts + fresh) ──────────────────────────────────────
  // Repeat contacts — appear at multiple conferences
  const repeatLeads = [
    {
      firstName: 'Tom', lastName: 'Müller', email: 'tom.muller@wise.com',
      company: 'Wise', jobTitle: 'Head of FX Operations',
      icpScore: 92, tags: ['fx_pain', 'decision_maker', 'champion'],
      hubspotContactId: 'hs_001_tom_muller',
      appearances: [
        { confName: 'FX Week Europe 2024', capturedBy: 'sarah.chen@grain.internal', date: '2024-09-09', notes: 'Strong FX pain. Wants to see hedging automation demo. Follow up in Q1.' },
        { confName: 'EuroFinance 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-09-18', notes: 'Relationship warming. Asked for a pilot proposal. Grain mentioned by 2 other contacts.' },
        { confName: 'Money20/20 Europe 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-06-03', notes: 'Confirmed pilot interest. Introduced to their CFO. Deal stage: Evaluation.' },
      ],
    },
    {
      firstName: 'Rachel', lastName: 'Goldstein', email: 'r.goldstein@booking.com',
      company: 'Booking.com', jobTitle: 'Head of Treasury',
      icpScore: 95, tags: ['fx_pain', 'decision_maker', 'demo_requested'],
      hubspotContactId: 'hs_002_rachel_goldstein',
      appearances: [
        { confName: 'EuroFinance 2024', capturedBy: 'sarah.chen@grain.internal', date: '2024-09-19', notes: 'Manages €2B+ FX. Interested in real-time hedging. Asked us to send a one-pager.' },
        { confName: 'Money20/20 Europe 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-06-02', notes: 'Requested live demo after seeing our stand. Very engaged — buying signals clear.' },
      ],
    },
    {
      firstName: 'Daniel', lastName: 'Cohen', email: 'd.cohen@stripe.com',
      company: 'Stripe', jobTitle: 'VP Finance & Treasury',
      icpScore: 88, tags: ['fx_pain', 'decision_maker'],
      hubspotContactId: 'hs_003_daniel_cohen',
      appearances: [
        { confName: 'FinTech Connect 2024', capturedBy: 'jake.martinez@grain.internal', date: '2024-11-27', notes: 'CFO of Flywire — education & healthcare payments. Significant FX complexity. Now at Stripe.' },
        { confName: 'Money20/20 USA 2024', capturedBy: 'jake.martinez@grain.internal', date: '2024-10-28', notes: 'Quick intro at our booth. Followed up post-conference. Warm lead.' },
      ],
    },
    {
      firstName: 'Maya', lastName: 'Santos', email: 'maya.santos@airbnb.com',
      company: 'Airbnb', jobTitle: 'VP Finance & Payments',
      icpScore: 90, tags: ['fx_pain', 'decision_maker', 'needs_followup', 'NEEDS_REVIEW'],
      hubspotContactId: null,
      appearances: [
        { confName: 'AFP Annual Conference 2024', capturedBy: 'jake.martinez@grain.internal', date: '2024-10-21', notes: 'Airbnb VP Finance. Heavy cross-border FX. Said current solution "barely works".' },
        { confName: 'Money20/20 USA 2024', capturedBy: 'jake.martinez@grain.internal', date: '2024-10-29', notes: 'Second meeting — more in depth. Intro\'d us to their treasury analyst. Still evaluating 2 competitors.' },
      ],
    },
    {
      firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@revolut.com',
      company: 'Revolut', jobTitle: 'Chief Financial Officer',
      icpScore: 94, tags: ['fx_pain', 'decision_maker', 'champion'],
      hubspotContactId: 'hs_005_priya_sharma',
      appearances: [
        { confName: 'Paris Fintech Forum 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-01-28', notes: 'Revolut CFO — scaling FX ops to handle 100+ currencies. Champion identified.' },
        { confName: 'Money20/20 Europe 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-06-04', notes: 'Third touchpoint. Revolut are shortlisting 2 vendors including Grain. Wants commercial proposal.' },
      ],
    },
    {
      firstName: 'Karl', lastName: 'Becker', email: 'k.becker@db.com',
      company: 'Deutsche Bank', jobTitle: 'MD, FX Structuring',
      icpScore: 82, tags: ['fx_pain', 'needs_followup', 'NEEDS_REVIEW'],
      hubspotContactId: null,
      appearances: [
        { confName: 'FX Week Europe 2024', capturedBy: 'sarah.chen@grain.internal', date: '2024-09-10', notes: 'Deutsche Bank — corporate FX structuring desk. Sees opportunity for automation.' },
        { confName: 'EuroFinance 2025', capturedBy: 'sarah.chen@grain.internal', date: '2025-09-17', notes: 'Reconnected. Still interested but procurement process is slow. Q1 2026 target.' },
      ],
    },
  ]

  // Fresh leads (single conference appearances)
  const freshLeads = [
    // Money20/20 USA 2024
    { firstName: 'Jennifer', lastName: 'Park', email: 'j.park@nuvei.com', company: 'Nuvei', jobTitle: 'Head of Financial Operations', icpScore: 85, tags: ['fx_pain', 'needs_followup'], conf: 'Money20/20 USA 2024', rep: 'jake.martinez@grain.internal', date: '2024-10-27', notes: 'PSP with heavy multi-currency complexity. Intro\'d by Daniel Cohen.', hubspot: 'hs_010' },
    { firstName: 'Carlos', lastName: 'Mendez', email: 'c.mendez@onafranca.com', company: 'ONA Franca', jobTitle: 'CEO', icpScore: 60, tags: ['tire_kicker'], conf: 'Money20/20 USA 2024', rep: 'jake.martinez@grain.internal', date: '2024-10-28', notes: 'Small startup — not ICP. Interested in a partnership, not a purchase.', hubspot: null },
    { firstName: 'Sarah', lastName: 'Okonkwo', email: 's.okonkwo@flutterwave.com', company: 'Flutterwave', jobTitle: 'VP Treasury', icpScore: 88, tags: ['fx_pain', 'decision_maker'], conf: 'Money20/20 USA 2024', rep: 'priya.nair@grain.internal', date: '2024-10-29', notes: 'Africa-focused PSP with major FX flows. VP of Treasury.', hubspot: 'hs_011' },
    // EuroFinance 2024
    { firstName: 'Hans', lastName: 'Schneider', email: 'h.schneider@siemens.com', company: 'Siemens', jobTitle: 'Head of FX Risk Management', icpScore: 90, tags: ['fx_pain', 'decision_maker', 'demo_requested'], conf: 'EuroFinance 2024', rep: 'sarah.chen@grain.internal', date: '2024-09-18', notes: 'Siemens HQ — manages billions in FX risk. Requested a product demo for October.', hubspot: 'hs_012' },
    { firstName: 'Isabella', lastName: 'Rossi', email: 'i.rossi@enel.com', company: 'Enel', jobTitle: 'Group Treasury', icpScore: 78, tags: ['fx_pain', 'NEEDS_REVIEW'], conf: 'EuroFinance 2024', rep: 'sarah.chen@grain.internal', date: '2024-09-19', notes: 'Italian energy giant. FX exposure across LatAm operations.', hubspot: null },
    // AFP 2024
    { firstName: 'Robert', lastName: 'Thompson', email: 'r.thompson@caterpillar.com', company: 'Caterpillar', jobTitle: 'Assistant Treasurer', icpScore: 83, tags: ['fx_pain', 'needs_followup'], conf: 'AFP Annual Conference 2024', rep: 'jake.martinez@grain.internal', date: '2024-10-22', notes: 'Global manufacturing — FX hedging across 50+ countries. Sent follow-up deck.', hubspot: 'hs_013' },
    { firstName: 'Linda', lastName: 'Foster', email: 'l.foster@hp.com', company: 'HP Inc', jobTitle: 'Head of Treasury Risk', icpScore: 87, tags: ['fx_pain', 'decision_maker', 'demo_requested'], conf: 'AFP Annual Conference 2024', rep: 'jake.martinez@grain.internal', date: '2024-10-23', notes: 'Active RFP for TMS. Grain shortlisted. Demo booked.', hubspot: 'hs_014' },
    // FinTech Connect 2024
    { firstName: 'Amelia', lastName: 'Hughes', email: 'a.hughes@zopa.com', company: 'Zopa', jobTitle: 'CFO', icpScore: 72, tags: ['needs_followup'], conf: 'FinTech Connect 2024', rep: 'sarah.chen@grain.internal', date: '2024-11-27', notes: 'UK neobank. Small FX exposure but growing. Warm conversation.', hubspot: null },
    { firstName: 'Ravi', lastName: 'Kapoor', email: 'r.kapoor@paysend.com', company: 'Paysend', jobTitle: 'Head of FX', icpScore: 86, tags: ['fx_pain', 'decision_maker'], conf: 'FinTech Connect 2024', rep: 'jake.martinez@grain.internal', date: '2024-11-28', notes: 'Global money transfer — 170+ countries, massive FX pain. Hot lead.', hubspot: 'hs_015' },
    // Paris Fintech Forum 2025
    { firstName: 'Claire', lastName: 'Dubois', email: 'c.dubois@lydia.com', company: 'Lydia', jobTitle: 'VP Finance', icpScore: 68, tags: ['needs_followup'], conf: 'Paris Fintech Forum 2025', rep: 'sarah.chen@grain.internal', date: '2025-01-29', notes: 'French fintech. Growing into EU FX space. Early stage prospect.', hubspot: null },
    { firstName: 'Ahmed', lastName: 'Benali', email: 'a.benali@cma-cgm.com', company: 'CMA CGM', jobTitle: 'Group Treasurer', icpScore: 91, tags: ['fx_pain', 'decision_maker', 'champion'], conf: 'Paris Fintech Forum 2025', rep: 'sarah.chen@grain.internal', date: '2025-01-28', notes: 'Global shipping giant — massive multi-currency exposure. Champion identified.', hubspot: 'hs_016' },
    // SWIFT Business Forum 2025
    { firstName: 'Patrick', lastName: 'O\'Brien', email: 'p.obrien@bankofireland.com', company: 'Bank of Ireland', jobTitle: 'Head of FX & Derivatives', icpScore: 80, tags: ['fx_pain', 'needs_followup'], conf: 'SWIFT Business Forum London 2025', rep: 'sarah.chen@grain.internal', date: '2025-04-23', notes: 'Corporate banking FX desk. Interested in automation tools.', hubspot: null },
    { firstName: 'Sophie', lastName: 'Larsson', email: 's.larsson@nordea.com', company: 'Nordea', jobTitle: 'Director, FX Solutions', icpScore: 85, tags: ['fx_pain', 'decision_maker'], conf: 'SWIFT Business Forum London 2025', rep: 'sarah.chen@grain.internal', date: '2025-04-24', notes: 'Nordic bank with corporate FX franchise. Active evaluation.', hubspot: 'hs_017' },
    // EuroFinance 2025
    { firstName: 'António', lastName: 'Ferreira', email: 'a.ferreira@galp.com', company: 'GALP', jobTitle: 'Treasury Director', icpScore: 82, tags: ['fx_pain'], conf: 'EuroFinance 2025', rep: 'sarah.chen@grain.internal', date: '2025-09-18', notes: 'Portuguese energy — FX across Angola, Brazil, Mozambique.', hubspot: null },
    { firstName: 'Nadia', lastName: 'Petrov', email: 'n.petrov@rwe.com', company: 'RWE', jobTitle: 'Head of FX Risk', icpScore: 89, tags: ['fx_pain', 'decision_maker', 'needs_followup'], conf: 'EuroFinance 2025', rep: 'sarah.chen@grain.internal', date: '2025-09-17', notes: 'German energy major. Complex EUR/USD/GBP hedging. Requested proposal.', hubspot: 'hs_018' },
  ]

  // Insert repeat contacts
  const leadIdMap: Record<string, string> = {}
  for (const l of repeatLeads) {
    const capturedById = (await prisma.user.findUnique({ where: { email: l.appearances[0].capturedBy } }))?.id ?? admin.id
    let lead = await prisma.lead.findFirst({ where: { email: l.email } })
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          firstName: l.firstName, lastName: l.lastName, email: l.email,
          company: l.company, jobTitle: l.jobTitle,
          icpScore: l.icpScore, tags: JSON.stringify(l.tags),
          hubspotContactId: l.hubspotContactId,
          capturedById, capturedAt: new Date(l.appearances[0].date),
        },
      })
    }
    leadIdMap[l.email] = lead.id

    for (const app of l.appearances) {
      const confId = pastMap[app.confName] ?? confMap[app.confName]
      if (!confId) continue
      const repUser = await prisma.user.findUnique({ where: { email: app.capturedBy } })
      const existing = await prisma.conferenceLead.findFirst({ where: { conferenceId: confId, leadId: lead.id } })
      if (!existing) {
        await prisma.conferenceLead.create({
          data: {
            conferenceId: confId, leadId: lead.id,
            engagementNotes: app.notes, capturedAt: new Date(app.date),
          },
        })
      }
      // Ensure rep assignment exists
      const confRec = await prisma.conference.findUnique({ where: { id: confId } })
      if (confRec && repUser) {
        const assignExisting = await prisma.conferenceAssignment.findFirst({ where: { conferenceId: confId, userId: repUser.id } })
        if (!assignExisting) {
          await prisma.conferenceAssignment.create({
            data: { conferenceId: confId, userId: repUser.id, role: 'PRIMARY', assignedById: admin.id },
          })
        }
      }
    }
  }

  // Insert fresh leads
  for (const l of freshLeads) {
    const confId = pastMap[l.conf] ?? confMap[l.conf]
    if (!confId) continue
    const repUser = await prisma.user.findUnique({ where: { email: l.rep } })
    if (!repUser) continue

    let lead = l.email ? await prisma.lead.findFirst({ where: { email: l.email } }) : null
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          firstName: l.firstName, lastName: l.lastName, email: l.email,
          company: l.company, jobTitle: l.jobTitle,
          icpScore: l.icpScore, tags: JSON.stringify(l.tags),
          hubspotContactId: l.hubspot ?? null,
          capturedById: repUser.id, capturedAt: new Date(l.date),
        },
      })
    }

    const existing = await prisma.conferenceLead.findFirst({ where: { conferenceId: confId, leadId: lead.id } })
    if (!existing) {
      await prisma.conferenceLead.create({
        data: { conferenceId: confId, leadId: lead.id, engagementNotes: l.notes, capturedAt: new Date(l.date) },
      })
    }
    const assignExisting = await prisma.conferenceAssignment.findFirst({ where: { conferenceId: confId, userId: repUser.id } })
    if (!assignExisting) {
      await prisma.conferenceAssignment.create({
        data: { conferenceId: confId, userId: repUser.id, role: 'PRIMARY', assignedById: admin.id },
      })
    }
  }
  console.log(`✓ Leads seeded (${repeatLeads.length} repeat contacts + ${freshLeads.length} fresh leads)`)

  // ── HubSpot sync logs for synced leads ────────────────────────────────────
  const syncedLeads = await prisma.lead.findMany({ where: { hubspotContactId: { not: null } }, take: 10 })
  for (const l of syncedLeads) {
    const existing = await prisma.hubspotSyncLog.findFirst({ where: { leadId: l.id } })
    if (!existing) {
      await prisma.hubspotSyncLog.create({
        data: { leadId: l.id, status: 'SUCCESS', response: JSON.stringify({ id: l.hubspotContactId }), syncedAt: new Date() },
      })
    }
  }

  // Failed sync log for Claire Dubois — demonstrates the "Sync failed" state in the demo
  const claireDubois = await prisma.lead.findFirst({ where: { firstName: 'Claire', lastName: 'Dubois', company: 'Lydia' } })
  if (claireDubois) {
    const clairesLog = await prisma.hubspotSyncLog.findFirst({ where: { leadId: claireDubois.id } })
    if (!clairesLog) {
      await prisma.hubspotSyncLog.create({
        data: {
          leadId: claireDubois.id,
          status: 'FAILED',
          isMockSync: true,
          response: JSON.stringify({ error: 'Contact property "email" value was not valid.', status: 400 }),
          syncedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }
  console.log('✓ HubSpot sync logs created')

  // ── Assign reps to upcoming conferences ──────────────────────────────────
  const assignments: Array<{ conf: string; rep: string }> = [
    // Sarah Chen — Europe
    { conf: 'Money20/20 Europe', rep: 'sarah.chen@grain.internal' },
    { conf: 'FX Week Europe', rep: 'sarah.chen@grain.internal' },
    { conf: 'EuroFinance International Treasury', rep: 'sarah.chen@grain.internal' },
    { conf: 'SWIFT Business Forum London', rep: 'sarah.chen@grain.internal' },
    { conf: 'Association of Corporate Treasurers (ACT) Annual', rep: 'sarah.chen@grain.internal' },
    { conf: 'EBAday', rep: 'sarah.chen@grain.internal' },
    { conf: 'Paris Fintech Forum', rep: 'sarah.chen@grain.internal' },
    { conf: 'TMS Summit', rep: 'sarah.chen@grain.internal' },
    { conf: 'FX Markets Europe', rep: 'sarah.chen@grain.internal' },
    { conf: 'FX Invest Europe', rep: 'sarah.chen@grain.internal' },
    // Jake Martinez — Americas
    { conf: 'Money20/20 USA', rep: 'jake.martinez@grain.internal' },
    { conf: 'AFP Annual Conference', rep: 'jake.martinez@grain.internal' },
    { conf: 'NACHA Payments', rep: 'jake.martinez@grain.internal' },
    { conf: 'FX Week US', rep: 'jake.martinez@grain.internal' },
    { conf: 'SWIFT Business Forum New York', rep: 'jake.martinez@grain.internal' },
    { conf: 'Currency Research Americas', rep: 'jake.martinez@grain.internal' },
    { conf: 'Phocuswright Conference', rep: 'jake.martinez@grain.internal' },
    { conf: 'FIA Expo', rep: 'jake.martinez@grain.internal' },
    // Priya Nair — APAC + ME (Sibos 2026 intentionally unassigned — Tier A coverage gap for demo)
    { conf: 'Seamless Middle East', rep: 'priya.nair@grain.internal' },
    { conf: 'Seamless Asia', rep: 'priya.nair@grain.internal' },
    { conf: 'Singapore Fintech Festival', rep: 'priya.nair@grain.internal' },
    { conf: 'Forex Expo Dubai', rep: 'priya.nair@grain.internal' },
  ]

  for (const a of assignments) {
    const confId = confMap[a.conf]
    if (!confId) continue
    const repUser = await prisma.user.findUnique({ where: { email: a.rep } })
    if (!repUser) continue
    const existing = await prisma.conferenceAssignment.findFirst({ where: { conferenceId: confId, userId: repUser.id } })
    if (!existing) {
      await prisma.conferenceAssignment.create({
        data: { conferenceId: confId, userId: repUser.id, role: 'PRIMARY', assignedById: admin.id },
      })
    }
    // Set campaign status to IN_PROGRESS for ATTENDING conferences
    const conf = await prisma.conference.findUnique({ where: { id: confId } })
    if (conf?.attendingStatus === 'ATTENDING') {
      await prisma.conference.update({ where: { id: confId }, data: { campaignStatus: 'IN_PROGRESS', outboundStatus: 'IN_PROGRESS' } })
    }
  }
  console.log(`✓ Rep assignments created`)

  console.log('\n🎉 Seed complete!')
  console.log('\nLogin credentials:')
  console.log('  admin@grain.internal   / admin')
  console.log('  alex.kim@grain.internal / grain123  (Manager)')
  console.log('  sarah.chen@grain.internal / grain123  (Sales – Europe)')
  console.log('  jake.martinez@grain.internal / grain123  (Sales – Americas)')
  console.log('  priya.nair@grain.internal / grain123  (Sales – APAC)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
