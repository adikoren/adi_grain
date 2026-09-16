# Product Requirements Document
## Conference Intelligence Tool

**Version:** 1.1  
**Date:** 2026-06-07  
**Stack:** Next.js 14 (App Router) · Prisma + SQLite · NextAuth.js (Credentials + Google OAuth) · Tailwind CSS + shadcn/ui · Tesseract.js · Corporate AI key (OpenAI / Anthropic)

---

## 1. Overview

A web-based Conference Intelligence Tool that helps a fintech sales team decide which conferences to attend, plan coverage, capture leads in the field, track relationships across events, and sync to HubSpot. Built for simplicity: one repo, SQLite file, deployable to Vercel with zero infrastructure overhead.

**Target Users:** Admin, Sales Managers, Sales Representatives  
**Primary ICP Focus:** Fintech, Payments, FX/Treasury, Travel wholesalers

---

## 2. Branding & Design

### 2.1 Source
Neutral placeholder identity — "CI" wordmark, no external brand reference.

### 2.2 Logo
- White "CI" text wordmark on dark backgrounds.
- Used in the top-left of the nav and on the login screen.

### 2.3 Color Palette

| Token | Value | Usage |
|---|---|---|
| `brand-dark` | `#0A0E1A` | Page backgrounds, nav bar |
| `brand-navy` | `#111827` | Card backgrounds, sidebar |
| `brand-accent` | `#4ADE80` | CTAs, active states, badges |
| `brand-accent-alt` | `#6366F1` | Secondary accent (ICP scores, AI features) |
| `text-primary` | `#F9FAFB` | Primary text on dark |
| `text-muted` | `#9CA3AF` | Secondary text, labels |
| `border` | `#1F2937` | Card borders, dividers |

### 2.4 Typography
- Font: `Inter` (Google Fonts) — clean, modern fintech style.
- Headings: `font-semibold`, `tracking-tight`.
- Body: `font-normal`, `text-sm` / `text-base`.

### 2.5 UI Tone
- Dark-first theme.
- Minimal chrome — content first.
- Green accent (`brand-accent`) used sparingly for high-signal actions (capture lead, sync to HubSpot, confirm assignment).

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack, API routes, SSR, easy Vercel deploy |
| Database | SQLite via Prisma ORM | Zero infra, portable, single file backup |
| Auth | NextAuth.js (Credentials + Google OAuth) | Email/password + Google Sign-In, JWT sessions |
| UI | Tailwind CSS + shadcn/ui | Responsive by default, mobile-friendly |
| OCR | Tesseract.js (client-side) | No server cost, works in browser |
| Fuzzy Match | Fuse.js | Client-side contact deduplication |
| AI | Corporate API key (OpenAI / Anthropic) | Single global key in env, not per-user |
| HubSpot | Mock API layer | Simulated CRM, swappable with real key |
| Deployment | Vercel (or any Node host) | One-click, zero config |

---

## 4. Roles & Permissions

### 4.1 Role Definitions

Three roles exist: **Admin**, **Manager**, **Sales Person**.

| Feature / Screen | Admin | Manager | Sales Person |
|---|---|---|---|
| Conference list (view) | ✅ | ✅ | ✅ |
| Conference scoring & filtering | ✅ | ✅ | ✅ (read-only) |
| Add / edit / archive conference | ✅ | ✅ | ❌ |
| Approve conference for eligibility | ✅ | ✅ | ❌ |
| Planning & coverage view | ✅ | ✅ | ❌ |
| Trip opportunities view | ✅ | ✅ | ❌ |
| Assign trip / conference to rep | ✅ | ✅ | ❌ |
| Invite users (by email) | ✅ | ✅ | ❌ |
| Manage user roles | ✅ | ✅ | ❌ |
| Remove / deactivate users | ✅ | ❌ | ❌ |
| Select "current conference" | ✅ | ✅ | ✅ |
| Lead capture (field) | ✅ | ✅ | ✅ |
| View own leads & contacts | ✅ | ✅ | ✅ |
| View all team leads | ✅ | ✅ | ❌ |
| Global AI / HubSpot settings | ✅ | ❌ | ❌ |
| HubSpot sync settings | ✅ | ✅ | ❌ |
| Analytics & pipeline dashboard | ✅ | ✅ | ❌ |

### 4.2 Built-in Admin Account
- A default admin user is seeded into the database on first run:
  - **Username:** `admin`
  - **Password:** `admin`
  - **Role:** `ADMIN`
- This account uses email/password login only (no Google OAuth).
- Admin should change the password on first login (soft prompt, not enforced).
- Admin cannot be deleted through the UI.

### 4.3 Role Assignment
- Only Admin can create Manager accounts.
- Managers and Admins can invite Sales Persons.
- Role is set at invitation time and can be changed later by Admin or Manager.

---

## 5. Authentication & Invitation System

### 5.1 Login Options

The login page presents two paths:

**Option A — Email / Password**
- Standard credential login.
- Only works for users who have been invited (record exists in `Invitation` table with status `ACCEPTED` or for the seeded admin).
- Form: Email field + Password field + "Log In" button.

**Option B — Google Sign-In**
- "Continue with Google" button (OAuth).
- Google account email must match an accepted invitation in the system.
- If email not in invitation list → login rejected with "You haven't been invited yet" message.
- On first Google login → account is created, invitation marked `ACCEPTED`.

### 5.2 Sign-Up (New User Registration)

Accessible via "Sign Up" link on the login page. Only for invited users.

**Flow:**
1. User enters their email address.
2. System checks if email exists in `Invitation` table with status `PENDING`.
   - If not found → "No invitation found for this email."
3. User fills in: Full Name, Password, Confirm Password.
   - Password validation: min 8 chars, must match.
4. On submit → `User` record created, `Invitation` status → `ACCEPTED`.
5. User is logged in and redirected to their role-appropriate dashboard.

### 5.3 Invitation Flow

**Who can invite:** Admin + Manager.

**Steps:**
1. Inviter goes to User Management → clicks "Invite User."
2. Form: Email address, Role (Manager / Sales Person).
3. System creates an `Invitation` record (status: `PENDING`, token generated).
4. _(Future: send email with invite link. For now: inviter shares the app URL manually, or a "copy invite link" button generates a link with the token.)_
5. Invited user arrives at `/invite/[token]` → pre-fills their email, prompts them to set password or use Google.
6. On completion → `Invitation.status = ACCEPTED`, `User` record created.

**Invitation constraints:**
- Invitations expire after 7 days (soft — flagged as `EXPIRED` but user can still register if admin re-sends).
- Duplicate email invitations are blocked — system shows "Already invited."
- Admin can revoke a pending invitation.

### 5.4 Access Control
- All routes except `/login`, `/signup`, `/invite/[token]` require an authenticated session.
- Middleware gates `/admin/*` to `ADMIN` role.
- Middleware gates `/manager/*` to `MANAGER` or `ADMIN` role.
- API routes validate session role server-side on every request.
- Unauthenticated requests are redirected to `/login`.

---

## 6. Data Model (Prisma Schema)

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  passwordHash    String?  // null for Google-only users
  avatarUrl       String?
  role            Role     @default(SALES_PERSON)
  currentConferenceId String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  // Relations
  invitedBy       User?    @relation("Inviter", fields: [invitedById], references: [id])
  invitedById     String?
  sentInvitations Invitation[] @relation("SentBy")
  assignments     ConferenceAssignment[]
  capturedLeads   Lead[]
}

enum Role {
  ADMIN
  MANAGER
  SALES_PERSON
}

model Invitation {
  id          String           @id @default(cuid())
  email       String
  role        Role             @default(SALES_PERSON)
  token       String           @unique @default(cuid())
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime
  sentBy      User             @relation("SentBy", fields: [sentById], references: [id])
  sentById    String
  createdAt   DateTime         @default(now())
  acceptedAt  DateTime?
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

model SystemConfig {
  id            String  @id @default("singleton")
  aiProvider    AIProvider @default(OPENAI)
  aiApiKey      String? // encrypted, stored globally
  hubspotMode   HubspotMode @default(MOCK)
  hubspotApiKey String? // encrypted
  updatedAt     DateTime @updatedAt
}

enum AIProvider { OPENAI ANTHROPIC }
enum HubspotMode { MOCK REAL }

model Conference {
  id               String   @id @default(cuid())
  name             String
  website          String?
  startDate        DateTime
  endDate          DateTime
  city             String
  country          String
  lat              Float?
  lng              Float?
  vertical         Vertical[]
  estimatedAudience Int?
  icpScore         Float    @default(0) // 0–100
  status           ConferenceStatus @default(DRAFT)
  source           ConferenceSource @default(MANUAL)
  notes            String?
  createdBy        User     @relation(fields: [createdById], references: [id])
  createdById      String
  assignments      ConferenceAssignment[]
  leads            ConferenceLead[]
  trips            TripConference[]
  createdAt        DateTime @default(now())
}

enum ConferenceStatus { DRAFT ELIGIBLE ARCHIVED }
enum ConferenceSource { MANUAL AUTO_IMPORT }
enum Vertical { FINTECH PAYMENTS FX TRAVEL SAAS TREASURY OTHER }

model ConferenceAssignment {
  id           String   @id @default(cuid())
  conference   Conference @relation(fields: [conferenceId], references: [id])
  conferenceId String
  user         User     @relation(fields: [userId], references: [id])
  userId       String
  role         AssignmentRole @default(PRIMARY)
  assignedBy   String
  assignedAt   DateTime @default(now())
}

enum AssignmentRole { PRIMARY BACKUP }

model TripOpportunity {
  id            String   @id @default(cuid())
  name          String
  clusterReason String?
  assignedTo    User?    @relation(fields: [assignedToId], references: [id])
  assignedToId  String?
  calculatedAt  DateTime @default(now())
  conferences   TripConference[]
}

model TripConference {
  trip         TripOpportunity @relation(fields: [tripId], references: [id])
  tripId       String
  conference   Conference      @relation(fields: [conferenceId], references: [id])
  conferenceId String
  @@id([tripId, conferenceId])
}

model Lead {
  id               String   @id @default(cuid())
  firstName        String
  lastName         String
  email            String?
  phone            String?
  company          String
  jobTitle         String?
  linkedinUrl      String?
  notes            String?
  cardImageUrl     String?  // stored in /public/uploads or base64
  rawCardText      String?  // OCR output
  icpScore         Float?   // AI-generated 0–100
  followUpDrafted  Boolean  @default(false)
  hubspotContactId String?
  capturedBy       User     @relation(fields: [capturedById], references: [id])
  capturedById     String
  capturedAt       DateTime @default(now())
  conferences      ConferenceLead[]
  matchesA         ContactMatch[] @relation("MatchA")
  matchesB         ContactMatch[] @relation("MatchB")
}

model ConferenceLead {
  id               String     @id @default(cuid())
  conference       Conference @relation(fields: [conferenceId], references: [id])
  conferenceId     String
  lead             Lead       @relation(fields: [leadId], references: [id])
  leadId           String
  engagementNotes  String?
  capturedAt       DateTime   @default(now())
}

model ContactMatch {
  id          String      @id @default(cuid())
  leadA       Lead        @relation("MatchA", fields: [leadAId], references: [id])
  leadAId     String
  leadB       Lead        @relation("MatchB", fields: [leadBId], references: [id])
  leadBId     String
  confidence  Float       // 0–1 fuzzy score
  resolvedAs  MatchResult @default(PENDING)
  resolvedBy  String?
  resolvedAt  DateTime?
}

enum MatchResult { SAME DIFFERENT PENDING }

model HubspotSyncLog {
  id        String     @id @default(cuid())
  leadId    String
  status    SyncStatus
  response  String?    // JSON
  syncedAt  DateTime   @default(now())
}

enum SyncStatus { PENDING SUCCESS FAILED }
```

---

## 7. Screens & Features

### 7.1 Shared: App Shell
- **Top nav:** "CI" logo (white wordmark on `brand-dark` bg), current-conference pill, user avatar + role badge.
- **Sidebar:** Role-aware nav links, collapses to bottom tab bar on mobile.
- **Theme:** Dark throughout. Green accent for primary actions.

---

### 7.2 Login Page (`/login`)

Split layout — left panel: "CI" logo + tagline. Right panel: auth forms.

**Tab 1 — Log In**
- Email + Password fields.
- "Log In" button (brand-accent).
- "Or continue with Google" divider + Google OAuth button.
- "Don't have an account? Sign Up" link.

**Tab 2 — Sign Up**
- Email field → real-time invitation check (debounced).
- If invited: Full Name, Password, Confirm Password fields appear.
- If not invited: inline error "No invitation found for this email."
- On success: auto-login, redirect to role dashboard.

**Invitation link entry (`/invite/[token]`):**
- Pre-fills email from token.
- User only sets Name + Password (or clicks Google).

---

### 7.3 Sales Person Dashboard (`/`)

Primary field-use screen. Optimized for mobile on a busy show floor.

- **Current Conference Selector** — prominent top card. Dropdown of `ELIGIBLE` conferences assigned to the user. Persists via `User.currentConferenceId` in DB.
- **Quick Lead Capture CTA** — large green "Add Lead" button.
- **My Leads Today** — leads captured at current conference, today.
- **My Upcoming Conferences** — sorted by date, with countdown badge.

**UX constraint:** "Add Lead" is reachable in one tap with no scrolling on any phone.

---

### 7.4 Lead Capture Flow (`/capture`)

Designed for < 60 seconds.

**Step 1 — Card Scan (optional)**
- Camera icon (large, tappable). Opens device camera via `<input capture="environment">`.
- Tesseract.js OCR runs in browser — no server call.
- Extracted data auto-populates the form below.
- Raw OCR text saved to `Lead.rawCardText`.

**Step 2 — Lead Form**
- Fields: First Name*, Last Name*, Email, Phone, Company*, Title, LinkedIn, Notes.
- **Live dedup panel:** After First Name + Last Name + Company filled, Fuse.js queries cached lead list. If match ≥ 0.85 confidence → shows "Looks like [Name] from [Company] — seen at [Conference X, Y]." 
  - Actions: **Link to existing** (adds a new `ConferenceLead` to existing lead), **Continue as new**, **Dismiss**.

**Step 3 — Save**
- Creates `Lead` + `ConferenceLead` for current conference.
- Queues HubSpot mock sync.
- Toast: "Lead saved ✓" → returns to dashboard.

---

### 7.5 Lead Detail (`/leads/[id]`)

Reps see their own; managers/admin see all.

- **Contact card** — card image, all fields, inline edit.
- **Conference History** — timeline of every conference encounter with per-encounter notes.
- **Cross-Conference Signal** (AI) — relationship arc narrative (see §9 AI Features).
- **ICP Score card** — score 0–100 with labeled breakdown bars.
- **Follow-up Email Draft** — AI-generated email, editable textarea, "Copy" button.
- **HubSpot Status** — sync badge + last sync time + "Sync Now" button.

---

### 7.6 Conference List (`/conferences`)

All users.

**Filters:** Vertical (multi-select), Date range, Country, ICP Score range, Status, Source.  
**Sort:** ICP Score ↓, Date ↑, Audience ↓.  
**Desktop:** Data table — Name, Dates, Location, Vertical tags, Audience, ICP Score badge, Status, Reps.  
**Mobile:** Card list with key fields.  
**Manager/Admin row actions:** Edit, Archive, Assign Rep.

---

### 7.7 Conference Detail (`/conferences/[id]`)

- Full metadata + ICP score breakdown (radar chart: vertical fit / audience quality / geography / timing / peer interest).
- Leads captured list (searchable).
- Assigned reps with role (PRIMARY / BACKUP).
- Manager/Admin: Edit button, Status toggle, Assign Rep dropdown.

---

### 7.8 Manager/Admin: Add / Edit Conference

Form: Name, Website, Dates, City, Country, Vertical(s), Audience, Notes, Status.

**AI Discovery panel** (requires global AI key):
- "Find New Conferences" button → AI searches web for upcoming fintech/payments/FX/travel conferences not in DB.
- Results as selectable cards — manager reviews and imports selected ones as `DRAFT`.
- Manager must explicitly set status to `ELIGIBLE`.

---

### 7.9 Manager/Admin: Planning & Coverage (`/manager/planning`)

**Year timeline:** Gantt-style, one row per month, conference blocks color-coded by vertical. Each block shows assigned rep avatars or a red "Unassigned" chip.

**Coverage gap alerts:** Sidebar list of months with no eligible conferences, or conferences with no assigned rep.

**Map view:** Leaflet.js world map, conference pins clustered by proximity. "Build Trip" button on a cluster → pre-creates a TripOpportunity.

---

### 7.10 Manager/Admin: Trip Opportunities (`/manager/trips`)

A trip = 2+ conferences within 500km AND ≤ 7 days apart.

**Calculation:** On-demand ("Recalculate" button) or nightly background job.

**Trip card:**
- Conference list (dates, cities).
- AI-generated trip name + 1-line rationale.
- **"Assign to Rep" dropdown** → sets `TripOpportunity.assignedTo`, creates `ConferenceAssignment` records for all conferences in the trip.
- Assigned rep sees trip on their dashboard.

---

### 7.11 Manager/Admin: User Management (`/manager/users`)

**Table:** Name, Email, Role badge, Invited by, Conferences assigned, Leads captured, Status (Active/Inactive).

**Actions (Manager):** Invite User, Change Role (Sales Person ↔ Manager), Deactivate.  
**Actions (Admin only):** Delete User, Change Role to Admin, Revoke any invitation.

**Invite User modal:**
- Email field + Role selector.
- Creates `Invitation` record.
- Shows "Copy invite link" button (generates `/invite/[token]` URL).

---

### 7.12 Manager/Admin: Analytics Dashboard (`/manager/analytics`)

- **Funnel:** Leads captured → ICP ≥ 70 → Synced to HubSpot.
- **By conference:** Leads captured, avg ICP score, rep coverage.
- **By rep:** Leads, conferences attended, avg ICP score of their leads.
- **Top cross-conference contacts:** Leads seen at 2+ conferences, sorted by appearance count.
- **ROI proxy:** ICP-qualified leads per conference (vs estimated cost if added).

---

### 7.13 Admin: System Settings (`/admin/settings`)

- **AI Configuration:**
  - Provider: OpenAI / Anthropic toggle.
  - API Key: input field (masked), "Test Key" button.
  - Saved to `SystemConfig` table (single row, encrypted at rest).
- **HubSpot Configuration:**
  - Mode: Mock / Real toggle.
  - Real API Key input.
  - "Test Connection" button.
- **System:**
  - Reset admin password.
  - Export all data (SQLite dump).

---

### 7.14 Cross-Conference Contact Tracking

**Matching on lead save (server-side + Fuse.js):**
1. Exact email match → auto-linked as `SAME` (no human review needed).
2. Name fuzzy (≥ 0.85) + company fuzzy (≥ 0.70) → `ContactMatch` with `PENDING`.
3. Name fuzzy + email domain match → higher confidence.

**Edge cases:**
- Name variants ("Mike" / "Michael") → fuzzy handles.
- Job change (same email, new company) → matched via email, delta shown in timeline.
- Same name, different person → low confidence, flagged `PENDING` for manager resolution.

**Manager: Contact Match Queue (`/manager/contacts`):**
- List of `PENDING` matches with confidence %, conference appearances for each lead.
- Actions per match: **Merge** (mark as `SAME`) or **Separate** (mark as `DIFFERENT`).

---

## 8. AI Features

All AI features use the **global corporate API key** from `SystemConfig`. If no key is configured, features show an "AI not configured — contact your admin" message (not a per-user prompt).

| Feature | Trigger | What AI does | Why AI fits |
|---|---|---|---|
| **Conference Discovery** | Manager → "Find Conferences" | Web search + extraction of upcoming fintech/payments/travel events | Too many fragmented sources to scan manually |
| **ICP Score** | Conference save / "Recalculate" | Scores 0–100 on vertical fit, audience quality, geography, timing | Consistent subjective judgment at scale |
| **Lead Qualification** | Lead save | Scores lead 0–100 on title seniority, company type, FX/payments relevance | Rep on show floor needs instant signal, no thinking required |
| **Follow-up Email Draft** | Lead detail page | Personalized email referencing conference, notes, ICP context | Saves 10 min per lead; reps edit and send |
| **Relationship Arc Summary** | Contact with ≥ 2 appearances | "Champion / evaluator / tire-kicker" narrative from engagement history | Pattern recognition across unstructured notes is AI's core strength |
| **Trip Name & Rationale** | Trip opportunity created | Names cluster, writes 1-line travel rationale | Makes auto-generated trips immediately understandable |

---

## 9. HubSpot Mock

### 9.1 Architecture
`lib/hubspot.ts` reads `SystemConfig.hubspotMode`:
- `MOCK` → all calls log to `HubspotSyncLog` with fake IDs, no external request.
- `REAL` → calls HubSpot REST API v3 with `SystemConfig.hubspotApiKey`.

Swap from mock to real = one config change, no code change.

### 9.2 Mock implements
- `createContact(lead)` → returns `{ id: "mock_hs_<uuid>" }`
- `updateContact(hubspotId, data)` → updates log entry
- `createNote(hubspotId, text)` → logs note
- `createDeal(hubspotId, dealName)` → logs deal stub

### 9.3 Mock HubSpot Dashboard (`/manager/hubspot`)
- Contacts synced (mock ID, name, email, sync time).
- Sync log table (lead, status, timestamp, response preview).
- "Sync All Pending" button.
- Mode indicator badge: MOCK (yellow) / REAL (green).

---

## 10. Public Conference Data Sources

### 10.1 AI-assisted discovery
Manager-triggered. Prompt instructs the LLM to search for conferences across:
- Aggregators: 10times.com, Eventbrite, Luma
- Industry calendars: FinTech Futures, Payments Journal, SWIFT
- Returns structured JSON: name, dates, location, website, vertical, audience estimate

### 10.2 Seed database (~50 conferences)
Bundled in `prisma/seed.ts`, pre-loaded on first run:

Money20/20 USA & Europe, Sibos, FinovateEurope, FinovateSpring, SWIFT Business Forum, EBAday, Currency Research Americas & London, AFP Annual Conference, Phocuswright, World Travel Market, PayExpo, Seamless Middle East, Seamless Asia, Singapore Fintech Festival, Paris Fintech Forum, MPE (Merchant Payments Ecosystem), The Paypers, NACHA Payments, Finovate Global, FX Week Europe, TMS Summit, Forex Expo Dubai, FIA Expo, Trustech, CurrencyFair Summit, + ~25 more.

---

## 11. Screen Map

```
/login                         — Login + Sign Up tabs
/invite/[token]                — Invitation acceptance

/ (Sales Person Dashboard)
├── /capture                   — Field lead capture
├── /leads                     — My leads list
│   └── /leads/[id]            — Lead detail + AI
├── /conferences               — Conference list
│   └── /conferences/[id]      — Conference detail
└── /settings                  — User profile (name, password change)

/manager/
├── /manager/planning          — Year timeline + coverage gaps
├── /manager/trips             — Trip opportunities + assign
├── /manager/conferences/new
├── /manager/conferences/[id]/edit
├── /manager/users             — User management + invitations
├── /manager/hubspot           — Mock HubSpot dashboard
├── /manager/contacts          — All contacts + match queue
└── /manager/analytics         — Pipeline + rep analytics

/admin/
└── /admin/settings            — AI key, HubSpot key, system config
```

---

## 12. Responsive / Mobile UX

- Tailwind responsive classes throughout (`sm:`, `md:`, `lg:`).
- Lead capture: highest-priority mobile screen — single column, large tap targets, camera-first.
- Conference list: table on desktop → card stack on mobile.
- Planning (Gantt): horizontal scroll on mobile with sticky month labels.
- Nav: sidebar on desktop → bottom tab bar on mobile (Dashboard, Capture, Conferences, Leads).

---

## 13. Build Phases

### Phase 1 — Foundation
- [ ] Next.js + Prisma + SQLite setup
- [ ] Seed: admin user + 50 conferences
- [ ] Credentials auth (email/password) + Google OAuth via NextAuth
- [ ] Invitation system (create, accept via link or sign-up)
- [ ] Role middleware + route gating
- [ ] Conference list + filter + static ICP scoring

### Phase 2 — Field Tools
- [ ] Sales person dashboard + current conference selector
- [ ] Lead capture + Tesseract.js OCR
- [ ] Fuse.js live dedup
- [ ] Lead detail page + conference history timeline

### Phase 3 — Planning & Trips
- [ ] Planning year timeline (Gantt)
- [ ] Geographic clustering algorithm → TripOpportunity
- [ ] Trip assign to rep

### Phase 4 — AI & HubSpot
- [ ] `SystemConfig` global AI key storage
- [ ] AI: ICP scores (conferences + leads)
- [ ] AI: Follow-up email draft
- [ ] AI: Relationship arc summary
- [ ] AI: Conference discovery
- [ ] HubSpot mock module + sync dashboard

### Phase 5 — Polish & Admin
- [ ] Manager analytics dashboard
- [ ] Contact match resolution queue
- [ ] Admin settings page (AI key, HubSpot key)
- [ ] Neutral branding (dark theme, logo, colors)
- [ ] Mobile nav (bottom tabs)
- [ ] Demo seed walkthrough prep

---

## 14. Design Decisions & Defaults

| Question | Decision |
|---|---|
| ICP score before AI key is set? | Rule-based fallback: +40 vertical, +20 audience >1000, +20 EU/US geography, +20 Q3/Q4 timing |
| Trip cluster radius | 500km + ≤ 7 day gap |
| Who sees other reps' leads? | Managers + Admin see all; reps see only their own |
| Contact dedup threshold | Email exact = auto-merge. Name fuzzy ≥ 0.85 + company ≥ 0.70 = PENDING |
| Current conference persistence | `User.currentConferenceId` in DB |
| Business card image storage | `/public/uploads/` directory (local); base64 in SQLite as fallback |
| Password storage | bcrypt hash via `bcryptjs` |
| AI key storage | Encrypted field in `SystemConfig` using `AES-256` with `APP_SECRET` env var |
| Admin default credentials | `admin` / `admin` — seeded, changeable, not deletable |
| Invitation expiry | 7 days; Admin can re-send |

---

*End of PRD v1.1*
