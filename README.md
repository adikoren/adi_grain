# Grain Finance — Conference Intelligence Tool

A sales intelligence platform for Grain Finance's field team to track fintech conferences, capture leads, and surface trip opportunities.

**Stack:** Next.js 14 · Prisma + SQLite · NextAuth v4 · Tailwind CSS · Tesseract.js (OCR) · Fuse.js (dedup) · Docker

---

## Quick Start (Local)

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

Edit `.env.local`:

```env
DATABASE_URL="file:./grain.db"
NEXTAUTH_SECRET="run-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### 4. Set up database

```bash
npx prisma db push
npx prisma db seed
```

This creates the SQLite database and seeds 50 fintech conferences + the admin user.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default login:** `admin` / `admin`

---

## Docker

### Build and run

```bash
# Copy and edit env
cp .env.example .env

# Build image
docker build -t grain-intel .

# Run with persistent data volume
docker run -d \
  --name grain-intel \
  -p 3000:3000 \
  --env-file .env \
  -v grain_data:/data \
  grain-intel
```

Or with Docker Compose:

```bash
cp .env.example .env
# Edit .env
docker-compose up -d
```

The SQLite database is stored in the `/data` volume and persists across container restarts.

---

## Free Hosting Options

### Option 1: Railway (Recommended ✅)

Railway offers $5/month free credits — enough for this app with SQLite.

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Add environment variables (Settings → Variables):
   - `NEXTAUTH_SECRET` (generate: `openssl rand -base64 32`)
   - `NEXTAUTH_URL` = `https://your-app.up.railway.app`
   - `DATABASE_URL` = `file:/data/grain.db`
   - Optionally: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
4. Add a Volume: mount at `/data`, size 1GB
5. Railway auto-detects Dockerfile and deploys

**Railway pro tip:** the app seeds itself on first run — no manual DB step needed.

### Option 2: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch
fly launch --name grain-intel

# Create persistent volume
fly volumes create grain_data --size 1

# Set secrets
fly secrets set NEXTAUTH_SECRET="..." NEXTAUTH_URL="https://grain-intel.fly.dev"

# Deploy
fly deploy
```

In `fly.toml`, add:
```toml
[mounts]
  source = "grain_data"
  destination = "/data"
```

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

To switch: Admin → Settings → HubSpot → select Real → enter key.

---

## Key Features

- **Conference list** with ICP scoring, vertical filtering, and search
- **Lead capture** with business card OCR scan (Tesseract.js) and auto-deduplication
- **Cross-conference tracking**: load a contact to see all previous engagements
- **Trip opportunity clustering**: haversine-based geographic grouping (≤500km, ≤7 day gap)
- **AI conference discovery**: fetches public fintech event sites, extracts structured data
- **Role-gated screens**: separate flows for reps vs managers
- **HubSpot sync**: mock or real, per-lead sync log

---

## Project Structure

```
grain/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Sales person screens
│   ├── manager/            # Manager screens
│   ├── admin/              # Admin screens
│   ├── api/                # API routes
│   ├── invite/[token]/     # Invite acceptance
│   └── login/              # Auth screens
├── components/layout/      # AppShell sidebar
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma singleton
│   ├── ai.ts               # OpenAI / Anthropic calls
│   ├── hubspot.ts          # HubSpot mock/real
│   └── icp-score.ts        # ICP scoring logic
├── prisma/
│   ├── schema.prisma       # DB schema
│   └── seed.ts             # Seed 50 conferences + admin
├── Dockerfile              # Multi-stage build
├── docker-compose.yml
└── .env.example
```

---

## Development Notes

- **Invite API:** `POST /api/invitations` — manager+ only
- **Signup:** `POST /api/auth/signup` — validates invite token
- **Conference discovery:** `POST /api/conferences/discover` — fetches 3 public fintech sites, passes to AI
- **Trips:** `POST /api/trips` with `action: recalculate` or `action: assign`

Built with ❤️ for Grain Finance's sales team.
