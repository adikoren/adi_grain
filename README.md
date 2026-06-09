# Grain Finance — Conference Intelligence Tool

A sales intelligence platform for Grain Finance's field team to track fintech conferences, capture leads, and surface trip opportunities.

**Stack:** Next.js 14 · Prisma + SQLite · NextAuth v4 · Tailwind CSS · Tesseract.js (OCR) · Fuse.js (dedup) · Docker

---

## Docker — Local Run

The fastest way to run the app. The Docker image has demo data baked in — no manual seeding needed.

### 1. Create your env file

```bash
cp .env.docker.example .env.docker
```

Open `.env.docker` and set two values:

```env
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

Everything else can stay as-is for local use.

### 2. Build and start

```bash
docker compose build
docker compose up
```

Open [http://localhost:3000](http://localhost:3000)

The first `docker compose build` takes 3–5 minutes (it compiles the app and seeds the demo database inside the image). Subsequent builds are fast thanks to layer caching.

### Demo login credentials

| Email | Password | Role |
|---|---|---|
| `admin@grain.internal` | `admin` | Admin |
| `alex.kim@grain.internal` | `grain123` | Manager |
| `sarah.chen@grain.internal` | `grain123` | Sales — Europe |
| `jake.martinez@grain.internal` | `grain123` | Sales — Americas |
| `priya.nair@grain.internal` | `grain123` | Sales — APAC |

### Stopping and resetting

```bash
# Stop (keeps data)
docker compose down

# Stop and wipe demo data (fresh seed on next start)
docker compose down -v
```

The SQLite database lives in the `grain_data` Docker volume at `/data/grain.db`. On first start the pre-seeded template is copied there automatically.

---

## Cloud Deployment

### Railway (recommended for demos)

1. Push the repo to GitHub.
2. Create a new project at [railway.app](https://railway.app) → **Deploy from GitHub**.
3. Railway auto-detects the `Dockerfile`.
4. Add a **Volume**: mount point `/data`, size 1 GB.
5. Set environment variables (Settings → Variables):

   | Variable | Value |
   |---|---|
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `https://your-app.up.railway.app` |
   | `DATABASE_URL` | `file:/data/grain.db` |

6. Deploy. On first start the seeded database is copied automatically.

### Render

1. Create a new **Web Service** → Docker runtime → connect your GitHub repo.
2. Add a **Persistent Disk**: mount path `/data`, size 1 GB.
3. Set the same three env vars (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`).
4. Deploy.

### Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/

fly launch --name grain-intel   # generates fly.toml, skip postgres
fly volumes create grain_data --size 1 --region <your-region>
fly secrets set \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  NEXTAUTH_URL="https://grain-intel.fly.dev" \
  DATABASE_URL="file:/data/grain.db"
fly deploy
```

Add to `fly.toml`:

```toml
[[mounts]]
  source      = "grain_data"
  destination = "/data"
```

### Important: SQLite + single instance

The app uses SQLite, which only supports one writer at a time. Run a **single instance** on your chosen platform — do not enable horizontal scaling. All three platforms above support single-instance deployments.

---

## Quick Start (Local Dev — no Docker)

### 1. Prerequisites

- Node.js 18+
- npm 9+

### 2. Install

```bash
git clone https://github.com/YOUR_ORG/grain-conference-intel.git
cd grain-conference-intel
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` — set `NEXTAUTH_SECRET` and leave `DATABASE_URL="file:./dev.db"`.

### 4. Set up database

```bash
npx prisma db push
npx prisma db seed
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## User Roles

| Role | Access |
|------|--------|
| `ADMIN` | Everything + System Settings |
| `MANAGER` | Analytics, Planning, Trips, Users, HubSpot, Contacts + all sales features |
| `SALES_PERSON` | Dashboard, Add Lead, My Leads, Conferences |

## Adding Users

Only invited users can sign in. As admin/manager:

1. Go to **Users** page
2. Enter email + select role → **Send Invite**
3. Copy the invite link and send it to the user
4. User visits the link, sets their name + password, and is logged in

## AI Configuration

1. Log in as admin
2. Go to **Settings** (Admin only)
3. Choose provider: **OpenAI** (`gpt-4o-mini`) or **Anthropic** (Claude Haiku)
4. Paste your API key
5. AI features activate: ICP scoring, follow-up drafts, relationship arcs, conference discovery

If no key is set, the app uses rule-based ICP scoring (no AI calls).

## HubSpot Integration

- **Mock mode** (default): leads are logged locally, no HubSpot API calls
- **Real mode**: set your HubSpot Private App key in Admin → Settings

---

## Key Features

- **Conference calendar** with ICP tier scoring, vertical filtering, and rep assignment
- **Lead capture** with business card OCR scan (Tesseract.js) and auto-deduplication
- **Cross-conference tracking**: load a contact to see all previous engagements
- **Manager planning**: cluster detection, coverage gaps, Tier A alerts
- **HubSpot sync**: mock or real mode, per-lead status and retry
- **Role-gated screens**: separate flows for reps vs managers

---

## Project Structure

```
grain/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Sales person screens + manager dashboard
│   ├── manager/            # Manager-only screens (planning, hubspot, users)
│   ├── admin/              # Admin-only settings
│   ├── api/                # API routes
│   └── login/              # Auth screens
├── components/layout/      # AppShell sidebar
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma singleton
│   ├── hubspot.ts          # HubSpot mock/real sync
│   └── icp-score.ts        # ICP scoring logic
├── prisma/
│   ├── schema.prisma       # DB schema (SQLite)
│   └── seed.ts             # Demo data seed
├── Dockerfile              # 4-stage build: deps → builder → seeder → runner
├── docker-compose.yml      # Local Docker run (uses .env.docker)
├── docker-entrypoint.sh    # Copies seeded DB on first start, launches server
├── .env.docker.example     # Template for Docker env vars
└── .env.example            # Template for local dev env vars
```

---

## Development Notes

- **Tests:** `npm test` — 430 tests, Vitest + Testing Library
- **Invite API:** `POST /api/invitations` — manager+ only
- **Signup:** `POST /api/auth/signup` — validates invite token
- **Conference discovery:** `POST /api/conferences/discover` — AI-powered
- **Trips:** `POST /api/trips` with `action: recalculate` or `action: assign`

Built for Grain Finance's sales team.
