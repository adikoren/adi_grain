# Conference Intelligence — Testing Guide

## Approach

**Framework**: Vitest + React Testing Library  
**Config**: `vitest.config.ts` — jsdom environment, `@testing-library/jest-dom` matchers, path alias `@/` → project root  
**Run all**: `npx vitest run`  
**Run one file**: `npx vitest run tests/<file>`  
**Watch mode**: `npx vitest`

### Layers

| Layer | Files | What's tested |
|-------|-------|---------------|
| Unit — pure logic | `icp-score*.test.ts`, `ai-lib.test.ts` | Scoring algorithms, AI prompt routing, fallbacks |
| Unit — API routes | `api-*.test.ts` | Auth guards, DB calls, error codes — DB and session mocked via `vi.hoisted` |
| Component — UI | `*-client.test.tsx`, `capture-page.test.tsx`, `conference-detail-panels.test.tsx` | Rendering, user interactions, async state, URL params — `fetch`, `next/navigation`, external libs mocked |

### Key patterns

- **DB mock**: `vi.hoisted(() => ({ modelName: { findUnique: vi.fn(), ... } }))` then `vi.mock('@/lib/db', () => ({ db: mockDb }))`.
- **Session mock**: `vi.mock('@/lib/auth', () => ({ getServerSession: mockGetSession }))` returning a user object or `null`.
- **Fetch mock**: `global.fetch = vi.fn()` — configure per-URL in `beforeEach` or per-test with `mockImplementation`.
- **Fuse.js**: mocked as a regular-function constructor (`function(items)`) so `new Fuse(...)` works in jsdom.
- **tesseract.js** (dynamic import): mocked via `vi.hoisted` + `vi.mock('tesseract.js', ...)` — worker object set up in `beforeEach`.
- **next/navigation**: `useRouter` returns mock `push`/`back`/`refresh`; `useSearchParams` returns a mutable `URLSearchParams` instance reset each test.
- **Async state**: use `screen.findByText(...)` or `waitFor(...)` after interactions. For the capture page, `await screen.findByText(/@ ConferenceName/)` proves both fetch chains resolved before typing.

### Update rule

**Whenever a test file is added or modified, update the relevant section below** — add new describe blocks, adjust counts, note new patterns.

---

## Test files

### `tests/ai-lib.test.ts` — AI library (35 tests)

**`draftFollowUpEmail`**
- throws when no API key configured
- calls Anthropic API when provider is ANTHROPIC
- calls OpenAI API when provider is OPENAI
- returns email draft string from Anthropic response
- signs off with repName when provided
- uses "The Team" sign-off when repName is null
- includes conference name in prompt when provided
- includes meeting notes in prompt when provided
- throws when Anthropic returns error response

**`summariseRelationshipArc`**
- throws when no API key configured
- returns arc summary string
- includes all conference appearances in prompt

**`aiScoreConference`**
- returns `{ score: 0, reasoning: "AI scoring unavailable" }` when no API key
- parses JSON score from LLM response
- returns fallback on malformed JSON
- strips code fences from response before parsing

---

### `tests/api-auth.test.ts` — POST /api/auth/signup (18 tests)
- returns 400 when email/password/name is missing or whitespace-only
- returns 400 when password is too short (< 8 chars); accepts exactly 8
- valid direct invite: sets password, clears token/expiry, returns 200
- direct invite expired → 403; null expiry → 200 (never expires)
- falls through to invitation check when invite token not found
- no invitation → 403; expired invitation → 403; duplicate user → 409
- valid standard flow: creates user, marks invitation ACCEPTED
- normalises email to lowercase; trims whitespace from name
- hashes password with bcrypt before storing

---

### `tests/api-conferences.test.ts` — Conference CRUD (8 tests)

**GET /api/conferences**
- returns conferences for authenticated users
- returns 401 for unauthenticated users

**POST /api/conferences**
- creates a conference for MANAGER; returns 403 for SALES_PERSON
- computes and stores icpScore from verticals + audience + country
- serialises verticals array to JSON string in DB

**PATCH /api/conferences/[id]**
- updates conference for MANAGER; returns 403 for SALES_PERSON

**DELETE /api/conferences/[id]**
- deletes for ADMIN; returns 403 for MANAGER/SALES_PERSON

---

### `tests/api-current-conference.test.ts` — /api/users/current-conference (9 tests)

**GET**
- 401 unauthenticated
- `{ conference: null }` when no currentConferenceId or user not found
- returns conference details when currentConferenceId set
- `{ conference: null }` when currentConferenceId points to deleted conference

**POST**
- 401 unauthenticated
- updates currentConferenceId in DB
- sets to null on empty string or undefined input
- returns `{ ok: true }` on success

---

### `tests/api-focus.test.ts` — PATCH /api/conferences/[id]/focus (6 tests)
- 401 unauthenticated; 403 when rep not assigned
- returns 200 and updates `myFocus` when assigned
- calls DB with correct fields; allows empty string (clearing)
- uses composite key `conferenceId_userId`

---

### `tests/api-invitations.test.ts` — /api/invitations (15 tests)

**GET /validate**
- `{ valid: false }` when no token
- `{ valid: true }` for PENDING non-expired Invitation
- `{ valid: false, reason: "used" }` for ACCEPTED
- `{ valid: false, reason: "expired" }` for expired
- `{ valid: true, isDirectInvite: true }` for User.inviteToken (not expired)
- null inviteExpiry → never expires
- not found anywhere → `{ valid: false, reason: "not_found" }`

**GET /check**
- `{ valid: false }` when no email
- `{ valid: true }` for PENDING invitation or valid User.inviteToken
- `{ valid: false }` for expired/missing token
- normalises email to lowercase; null expiry = valid

---

### `tests/api-leads.test.ts` — /api/leads (14 tests)

**GET**
- 401 unauthenticated
- SALES_PERSON: filtered by capturedById; MANAGER/ADMIN: all leads
- default take 50; `?all=1` → 1000

**POST**
- 401 unauthenticated; 400 missing firstName/lastName/company
- creates lead with computed icpScore; sets capturedById
- creates ConferenceLead when conferenceId provided
- mergeLeadId: skips lead creation, upserts conferenceLead
- mergeLeadId without conferenceId does not upsert

---

### `tests/api-leads-id.test.ts` — /api/leads/[id] (9 tests)

**GET**
- 401 unauthenticated; 404 not found
- 403 when sales rep accesses another rep's lead
- 200 for own lead; MANAGER/ADMIN can access any lead

**POST**
- draft-followup: generates draft, saves to lead, passes conferenceName/repName
- relationship-arc: short-circuits with message when ≤1 conference
- relationship-arc: calls summariseRelationshipArc for multiple conferences
- unknown action → 400

---

### `tests/api-plan.test.ts` — PATCH /api/conferences/[id]/plan (6 tests)
- 200 for MANAGER/ADMIN; 403 for SALES_PERSON; 403 unauthenticated
- updates only supplied fields (partial patch)
- casts meetingsScheduled to Number

---

### `tests/api-signup.test.ts` — POST /api/auth/signup — extended (16 tests)
_(mirrors api-auth.test.ts with additional bcrypt and trim coverage)_

---

### `tests/api-targets.test.ts` — /api/conferences/[id]/targets (12 tests)

**POST**
- creates target, returns 200; 403 SALES_PERSON; 401 unauthenticated
- returns 400 when company missing; passes conferenceId from URL
- defaults priority to MEDIUM when not supplied

**PATCH**
- any authenticated user can update status; 401 unauthenticated
- calls Prisma update with correct targetId

**DELETE**
- deletes and returns 200; 403 SALES_PERSON; 401 unauthenticated

---

### `tests/api-trips.test.ts` — /api/trips (12 tests)
- 401 unauthenticated; enriched trips with conference data
- SALES_PERSON can access; unknown conferenceIds filtered gracefully

**POST actions**
- `assign` with tripId: creates assignment, flips conference to ATTENDING
- `assign` with conferenceIds (no tripId): creates assignments without tripOpportunity
- `recalculate`: clusters within 500 km + 7-day window; excludes far/old/no-coords
- `recalculate`: deletes existing trip opportunities first; ADMIN allowed
- unknown action → 400

---

### `tests/api-companies.test.ts` — GET /api/leads/companies (8 tests)
- 401 unauthenticated
- returns companies from target accounts when conferenceId provided
- target account companies appear before lead companies
- filters by `q` query param (passed to Prisma)
- returns distinct companies (no duplicates)
- caps at 20 results
- returns empty array when no matches
- does not query target accounts when no conferenceId

---

### `tests/api-suggest.test.ts` — POST /api/leads/suggest (8 tests)
- 401 unauthenticated
- returns `{ suggestions: null, reason: "no_key" }` when no API key
- returns `{ suggestions: null, reason: "no_key" }` when config missing entirely
- calls OpenAI with company and jobTitle in prompt
- calls Anthropic API when provider is ANTHROPIC
- returns structured suggestions object (context, icpRelevance, followUpAngle)
- handles AI error gracefully (returns `{ suggestions: null, reason: "ai_error" }`)
- handles malformed JSON from AI gracefully

---

### `tests/capture-page.test.tsx` — CapturePage (54 tests)

**Form rendering** (4 tests)
- renders all required form fields
- shows "Save Lead" submit button
- shows current conference name in subtitle
- shows "Scan Business Card" scan option

**URL param pre-fill** (6 tests)
- pre-fills company / jobTitle from URL params; both together
- uses conferenceId from URL (skips current-conference API)
- shows conference name from URL in subtitle; empty when no params

**Email exact match dedup** (7 tests)
- shows relationship context banner / "Add to their history" / "Create new contact instead"
- shows conference history and engagement notes
- does NOT show context for unknown email
- case-insensitive matching

**Fuzzy name similarity** (8 tests)
- shows "Similar contacts" panel when name matches; shows lead name, company, job title
- "Same person?" button toggles to "✓ Same person" and back
- does NOT trigger with only first name
- clears panel when last name is cleared

**Warm relationship context card** (3 tests)
- Warm temperature badge; met-N× count; company name shown

**Form validation** (2 tests)
- error on missing required fields; email alone is not enough

**Form submission** (5 tests)
- POSTs to /api/leads with required fields
- includes / excludes mergeLeadId correctly
- redirects to / on success; shows error on failure

**Company autocomplete + person suggestion** (7 tests)
- suggestions appear when typing
- clicking a suggestion fills the company field
- job title chip buttons are shown
- clicking a chip sets the job title
- person suggestion card appears when URL has both company and jobTitle
- accepting suggestion fills firstName and lastName
- dismissing suggestion removes the card

**Business card scan (OCR)** (11 tests)
- no spinner before scan; shows "Scanning card…" during processing; hides after
- fills firstName/lastName from first line; email and phone extracted
- single-word name (no lastName); multi-word last name joined correctly
- triggers relationship context when scanned email matches existing lead
- handles OCR failure gracefully (spinner clears, form blank)
- calls `createWorker('eng')`; terminates worker after recognition

---

### `tests/conference-detail-panels.test.tsx` — ConferenceDetailClient (57 tests)

**Overview tab** (11 tests)
- name + attending badge; Live now / Past event / My conference badges
- website link; No rep assigned alert; No target accounts alert (manager only)
- Edit Conference button visibility

**My Focus tab** (11 tests)
- tab label; "No target companies" empty state
- company card: name, notes, expected attendee row (contactName), priority badges
- HIGH/MEDIUM badge colours; sort order (HIGH before MEDIUM)
- focus textarea auto-saves on blur via fetch; attending status badge

**Suggested Leads panel** (13 tests)
- shown when targets exist; hidden when none
- company name shown; role chip buttons present
- role chip links: company, jobTitle, conferenceId, conferenceName URL params
- known contact primary chip with their role; Fill form → link
- no known contact row when contactName null

**Planning tab — manager view** (5 tests)
- Planning tab label; Target Accounts panel; + Add Target button
- rep does not see + Add Target; add form appears on click

---

### `tests/conferences-client.test.tsx` — ConferencesClient (22 tests)
- renders all conferences; search by name/city; tier/region/status/multi filters
- Clear button resets; empty state; No rep warning; Edit link (manager)
- Archive/Calendar buttons; + Add Conference (manager only)
- count of filtered vs total

---

### `tests/dashboard-client.test.tsx` — DashboardClient (17 tests)
- greeting; No conference selected when none
- auto-selects ongoing conf when currentConferenceId null
- prefers saved ID over ongoing; clears stale ID
- conference name/city/country in hero; selector dropdown
- changing selector → fetch to save; today leads count / 0 / empty state
- KPI row; Today/Tomorrow badges; Add Lead button; hero click navigates

---

### `tests/icp-score.test.ts` — ICP scoring (24 tests)

**`scoreConference`** — maxes at 100; FX-pain by vertical; density by audience;
market boost (GB/US/SG); autumn agenda peak; never > 100; null-safe

**`scoreBreakdown`** — 5 dimensions with correct keys, maxes, sum matches score

**`scoreToTier`** — A ≥ 70, B 45–69, C < 45; boundary values

**`scoreIcpBadge`** — tier class names; label format; no .bg/.color props

**`scoreLead`** — C-suite / FX titles; fintech company bonus; cap at 100; null-safe

**`leadTemperature`** — Qualified / Warm / Cold by tag; precedence rules

**`temperatureBadgeClass`** — maps warmth → CSS class

---

### `tests/icp-score-extended.test.ts` — Extended scoring (22 tests)

**`leadTemperature` (extended)** — 11 tag-combination cases including unknown tags, combos, precedence

**`scoreBreakdown` (extended)** — dimension maxes (density 30, dm 25, agenda 10, networking 10); sum integrity; fxPain by vertical tier

**`scoreIcpBadge` (extended)** — boundary scores 0/44/45/50/69/70/85/100; label format

---

### `tests/leads-client.test.tsx` — LeadsClient (22 tests)
- renders all; search by first/last name/company
- warmth filter (Qualified/Warm/Cold); HubSpot filter (synced/unsynced)
- Clear resets; Rep column manager-only; rep name as link
- ↩ Met N× for repeats; +N indicator; conference name cell; — for none
- No leads / No match empty states; + Add Lead button; HubSpot badge

---

### `tests/planning-client.test.tsx` — PlanningClient (21 tests)
- default Coverage Gaps tab; unassigned Tier-A (red) / Tier-B/C (amber); All assigned state
- Workload tab: rep conference count, Tier A count
- Full List tab: conferences grouped by month
- Summary stats: Upcoming, Tier A, Unassigned, Tier A unassigned counts
- Assign dropdown (manager only); reps list; triggers /api/trips fetch
- + Add Conference (manager only)
- Tab navigation: Coverage Gaps → Workload → Full List
