import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const conferences = [
  // ── Tier 1: Core ICP – Payments & FX ──────────────────────────────────
  { name: 'Money20/20 USA', city: 'Las Vegas', country: 'US', lat: 36.1699, lng: -115.1398, startDate: '2026-10-22', endDate: '2026-10-25', verticals: ['PAYMENTS', 'FINTECH'], audience: 13000, icp: 95, website: 'https://us.money2020.com' },
  { name: 'Money20/20 Europe', city: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041, startDate: '2026-06-01', endDate: '2026-06-04', verticals: ['PAYMENTS', 'FINTECH'], audience: 8000, icp: 92, website: 'https://europe.money2020.com' },
  { name: 'Sibos', city: 'Sydney', country: 'AU', lat: -33.8688, lng: 151.2093, startDate: '2026-10-12', endDate: '2026-10-15', verticals: ['FX', 'PAYMENTS', 'FINTECH'], audience: 10000, icp: 90, website: 'https://sibos.com' },
  { name: 'EBAday', city: 'Lisbon', country: 'PT', lat: 38.7223, lng: -9.1393, startDate: '2026-06-09', endDate: '2026-06-10', verticals: ['PAYMENTS', 'FINTECH'], audience: 1200, icp: 88, website: 'https://ebaday.com' },
  { name: 'FX Week Europe', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-09-14', endDate: '2026-09-15', verticals: ['FX'], audience: 600, icp: 95, website: 'https://fxweek.com/events' },
  { name: 'Currency Research Americas', city: 'Miami', country: 'US', lat: 25.7617, lng: -80.1918, startDate: '2026-03-16', endDate: '2026-03-18', verticals: ['FX'], audience: 400, icp: 92, website: 'https://currencyresearch.com' },
  { name: 'Currency Research Banknote Conference', city: 'Lisbon', country: 'PT', lat: 38.7223, lng: -9.1393, startDate: '2026-05-18', endDate: '2026-05-20', verticals: ['FX'], audience: 500, icp: 88, website: 'https://currencyresearch.com' },
  { name: 'FX Markets Europe', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-09-10', endDate: '2026-09-11', verticals: ['FX'], audience: 500, icp: 90, website: 'https://fxmarkets.com' },
  { name: 'Merchant Payments Ecosystem (MPE)', city: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405, startDate: '2026-02-17', endDate: '2026-02-19', verticals: ['PAYMENTS'], audience: 1500, icp: 85, website: 'https://merchantpaymentsecosystem.com' },
  { name: 'PayExpo', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-06-10', endDate: '2026-06-11', verticals: ['PAYMENTS', 'FINTECH'], audience: 3500, icp: 82, website: 'https://payexpo.com' },
  { name: 'NACHA Payments', city: 'San Diego', country: 'US', lat: 32.7157, lng: -117.1611, startDate: '2026-04-12', endDate: '2026-04-15', verticals: ['PAYMENTS'], audience: 3000, icp: 80, website: 'https://nacha.org/payments' },
  { name: 'AFP Annual Conference', city: 'Nashville', country: 'US', lat: 36.1627, lng: -86.7816, startDate: '2026-10-18', endDate: '2026-10-21', verticals: ['FX', 'TREASURY'], audience: 7000, icp: 85, website: 'https://afponline.org' },
  { name: 'TMS Summit', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-03-10', endDate: '2026-03-11', verticals: ['FX', 'TREASURY'], audience: 400, icp: 88, website: 'https://tmssummit.com' },
  { name: 'Seamless Middle East', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-04-14', endDate: '2026-04-15', verticals: ['PAYMENTS', 'FINTECH'], audience: 5000, icp: 78, website: 'https://seamless-expo.com' },
  { name: 'Seamless Asia', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-09-08', endDate: '2026-09-09', verticals: ['PAYMENTS', 'FINTECH'], audience: 4000, icp: 76, website: 'https://seamless-expo.com/asia' },
  // ── Tier 2: Fintech Broad ──────────────────────────────────────────────
  { name: 'FinovateEurope', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-02-24', endDate: '2026-02-25', verticals: ['FINTECH'], audience: 1500, icp: 78, website: 'https://finovate.com/europe' },
  { name: 'FinovateSpring', city: 'San Francisco', country: 'US', lat: 37.7749, lng: -122.4194, startDate: '2026-05-19', endDate: '2026-05-21', verticals: ['FINTECH'], audience: 1200, icp: 75, website: 'https://finovate.com/spring' },
  { name: 'FinovateGlobal', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-10-05', endDate: '2026-10-06', verticals: ['FINTECH'], audience: 1000, icp: 75, website: 'https://finovate.com/global' },
  { name: 'Paris Fintech Forum', city: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522, startDate: '2026-01-27', endDate: '2026-01-28', verticals: ['FINTECH', 'PAYMENTS'], audience: 2500, icp: 80, website: 'https://parisfintechforum.com' },
  { name: 'Singapore Fintech Festival', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-11-09', endDate: '2026-11-11', verticals: ['FINTECH', 'PAYMENTS'], audience: 45000, icp: 72, website: 'https://fintechfestival.sg' },
  { name: 'SWIFT Business Forum London', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-04-22', endDate: '2026-04-23', verticals: ['FX', 'PAYMENTS'], audience: 800, icp: 87, website: 'https://swift.com/events' },
  { name: 'SWIFT Business Forum New York', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-05-07', endDate: '2026-05-07', verticals: ['FX', 'PAYMENTS'], audience: 600, icp: 86, website: 'https://swift.com/events' },
  { name: 'Finovate Global Fintech Conference', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-11-18', endDate: '2026-11-19', verticals: ['FINTECH'], audience: 1800, icp: 70, website: 'https://finovate.com' },
  { name: 'FinTech Connect', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-11-30', endDate: '2026-12-01', verticals: ['FINTECH'], audience: 3000, icp: 73, website: 'https://fintechconnect.com' },
  { name: 'Global FinTech Fest', city: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.8777, startDate: '2026-08-25', endDate: '2026-08-27', verticals: ['FINTECH', 'PAYMENTS'], audience: 25000, icp: 65, website: 'https://globalfintechfest.com' },
  { name: 'Crypto Finance Conference', city: 'St. Moritz', country: 'CH', lat: 46.4981, lng: 9.8384, startDate: '2026-01-14', endDate: '2026-01-16', verticals: ['FINTECH'], audience: 500, icp: 60, website: 'https://crypto-finance-conference.com' },
  // ── Tier 3: Travel & Wholesale ─────────────────────────────────────────
  { name: 'Phocuswright Conference', city: 'Phoenix', country: 'US', lat: 33.4484, lng: -112.074, startDate: '2026-11-17', endDate: '2026-11-19', verticals: ['TRAVEL'], audience: 1800, icp: 82, website: 'https://phocuswright.com' },
  { name: 'World Travel Market London', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-11-02', endDate: '2026-11-04', verticals: ['TRAVEL'], audience: 40000, icp: 70, website: 'https://wtm.com' },
  { name: 'ITB Berlin', city: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405, startDate: '2026-03-03', endDate: '2026-03-07', verticals: ['TRAVEL'], audience: 160000, icp: 65, website: 'https://itb.com' },
  { name: 'Skift Global Forum', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-09-15', endDate: '2026-09-16', verticals: ['TRAVEL'], audience: 900, icp: 75, website: 'https://skift.com/forum' },
  { name: 'Arabian Travel Market', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-04-28', endDate: '2026-05-01', verticals: ['TRAVEL'], audience: 25000, icp: 68, website: 'https://arabiantravelmarket.wtm.com' },
  // ── Tier 4: Cross-border & Treasury ───────────────────────────────────
  { name: 'FIA Expo', city: 'Chicago', country: 'US', lat: 41.8781, lng: -87.6298, startDate: '2026-11-03', endDate: '2026-11-05', verticals: ['FX', 'FINTECH'], audience: 3500, icp: 78, website: 'https://fia.org/expo' },
  { name: 'Forex Expo Dubai', city: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708, startDate: '2026-09-28', endDate: '2026-09-29', verticals: ['FX'], audience: 5000, icp: 80, website: 'https://forexexpo.ae' },
  { name: 'FX Week US', city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, startDate: '2026-06-08', endDate: '2026-06-09', verticals: ['FX'], audience: 400, icp: 90, website: 'https://fxweek.com/events' },
  { name: 'EuroFinance International Treasury', city: 'Barcelona', country: 'ES', lat: 41.3851, lng: 2.1734, startDate: '2026-09-23', endDate: '2026-09-25', verticals: ['FX', 'TREASURY'], audience: 3000, icp: 88, website: 'https://eurofinance.com' },
  { name: 'Association of Corporate Treasurers (ACT) Annual', city: 'Manchester', country: 'GB', lat: 53.4808, lng: -2.2426, startDate: '2026-05-19', endDate: '2026-05-20', verticals: ['FX', 'TREASURY'], audience: 1200, icp: 85, website: 'https://treasurers.org' },
  { name: 'Trustech', city: 'Nice', country: 'FR', lat: 43.7102, lng: 7.262, startDate: '2026-12-01', endDate: '2026-12-03', verticals: ['PAYMENTS', 'FINTECH'], audience: 10000, icp: 70, website: 'https://trustech-event.com' },
  { name: 'The Paypers Summit', city: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041, startDate: '2026-10-07', endDate: '2026-10-08', verticals: ['PAYMENTS', 'FINTECH'], audience: 800, icp: 77, website: 'https://thepaypers.com/events' },
  { name: 'Payments Innovation Forum', city: 'Toronto', country: 'CA', lat: 43.6532, lng: -79.3832, startDate: '2026-05-05', endDate: '2026-05-06', verticals: ['PAYMENTS'], audience: 500, icp: 72, website: 'https://paymentsinnovation.com' },
  { name: 'Cross Border Summit', city: 'Shenzhen', country: 'CN', lat: 22.5431, lng: 114.0579, startDate: '2026-11-10', endDate: '2026-11-12', verticals: ['PAYMENTS', 'FX'], audience: 3000, icp: 74, website: 'https://crossbordersummit.com' },
  // ── Additional ─────────────────────────────────────────────────────────
  { name: 'Money Expo Mexico', city: 'Mexico City', country: 'MX', lat: 19.4326, lng: -99.1332, startDate: '2026-06-03', endDate: '2026-06-04', verticals: ['FINTECH', 'PAYMENTS'], audience: 4000, icp: 68, website: 'https://moneyexpo.mx' },
  { name: 'LatAm Fintech Summit', city: 'Sao Paulo', country: 'BR', lat: -23.5505, lng: -46.6333, startDate: '2026-08-19', endDate: '2026-08-20', verticals: ['FINTECH', 'PAYMENTS'], audience: 2500, icp: 67, website: 'https://latamfintechsummit.com' },
  { name: 'Africa Fintech Summit', city: 'Nairobi', country: 'KE', lat: -1.2921, lng: 36.8219, startDate: '2026-11-04', endDate: '2026-11-05', verticals: ['FINTECH', 'PAYMENTS'], audience: 1500, icp: 62, website: 'https://africafintechsummit.com' },
  { name: 'Oslo Fintech Week', city: 'Oslo', country: 'NO', lat: 59.9139, lng: 10.7522, startDate: '2026-09-07', endDate: '2026-09-09', verticals: ['FINTECH'], audience: 700, icp: 65, website: 'https://www.oslofintech.com' },
  { name: 'Reinventing Payments Asia', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-07-14', endDate: '2026-07-15', verticals: ['PAYMENTS'], audience: 600, icp: 72, website: 'https://reinventingpayments.asia' },
  { name: 'FX Invest Europe', city: 'Frankfurt', country: 'DE', lat: 50.1109, lng: 8.6821, startDate: '2026-10-19', endDate: '2026-10-20', verticals: ['FX'], audience: 400, icp: 85, website: 'https://fxinvest.com' },
  { name: 'Forex Magnates London Summit', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-11-10', endDate: '2026-11-11', verticals: ['FX', 'FINTECH'], audience: 2000, icp: 78, website: 'https://financemagnates.com' },
  { name: 'B2B Payments Summit', city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, startDate: '2026-04-28', endDate: '2026-04-29', verticals: ['PAYMENTS'], audience: 600, icp: 80, website: 'https://b2bpayments-summit.com' },
  { name: 'TransferWise & Cross-Border Forum', city: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041, startDate: '2026-05-12', endDate: '2026-05-13', verticals: ['FX', 'PAYMENTS'], audience: 350, icp: 83, website: 'https://crossborderforum.eu' },
  { name: 'Accounting & Finance Show Asia', city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198, startDate: '2026-09-22', endDate: '2026-09-23', verticals: ['TREASURY', 'FINTECH'], audience: 2000, icp: 68, website: 'https://acfshow.com' },
]

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminHash = await bcrypt.hash('admin', 10)
  await prisma.user.upsert({
    where: { email: 'admin@grain.internal' },
    update: {},
    create: {
      email: 'admin@grain.internal',
      name: 'Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✓ Admin user created (admin@grain.internal / admin)')

  // Create system config
  await prisma.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      aiProvider: 'OPENAI',
      hubspotMode: 'MOCK',
    },
  })
  console.log('✓ System config initialised')

  // Seed conferences
  let seeded = 0
  for (const c of conferences) {
    const start = new Date(c.startDate)
    const end = new Date(c.endDate)
    await prisma.conference.upsert({
      where: { name: c.name } as any,
      update: { icpScore: c.icp },
      create: {
        name: c.name,
        website: c.website,
        startDate: start,
        endDate: end,
        city: c.city,
        country: c.country,
        lat: c.lat,
        lng: c.lng,
        verticals: JSON.stringify(c.verticals),
        estimatedAudience: c.audience,
        icpScore: c.icp,
        status: 'ELIGIBLE',
        source: 'SEED',
      },
    })
    seeded++
  }
  console.log(`✓ ${seeded} conferences seeded`)
  console.log('\n🎉 Seed complete!')
  console.log('\nLogin credentials:')
  console.log('  Email:    admin@grain.internal')
  console.log('  Password: admin')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
