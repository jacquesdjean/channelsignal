# ChannelSignal

Email-first channel sales intelligence. BCCs + screenshots → deal tracking across orgs without CRM write access.

## Stack

- Next.js 14 (App Router)
- Prisma + Postgres
- Tailwind CSS
- NextAuth (Email provider)

## Quickstart

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm prisma migrate dev
pnpm dev
```

Open http://localhost:3000

## Dev Notes

- **Sign-in:** Magic links logged to console in dev. Check terminal output.
- **DB GUI:** `pnpm prisma studio` → http://localhost:5555
- **Health check:** `GET /api/health/db`
- **Test inbound email:** `POST /api/inbound/email` (see API docs below)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health/db | Database connectivity check |
| POST | /api/inbound/email | Simulate BCC'd email receipt |
| POST | /api/uploads | Upload file to channel |
| POST | /api/test-email | Trigger dev email log |
| GET | /api/channels | List all channels |
| POST | /api/channels | Create a new channel |

## Inbound Email API

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -d '{
    "bccSlug": "acme-q4-renewal",
    "from": "rep@example.com",
    "to": ["buyer@acme.com"],
    "cc": [],
    "subject": "Q4 renewal discussion",
    "bodyStub": "Hi team, following up on...",
    "timestamp": "2025-01-15T14:30:00Z",
    "externalId": "message-id-header-value"
  }'
```

## File Upload API

```bash
curl -X POST http://localhost:3000/api/uploads \
  -F "file=@/path/to/file.pdf" \
  -F "channelId=your-channel-id"
```

## Project Structure

```
/app
  /inbox           # Email events list
  /channels        # Channel management
  /uploads         # File uploads
  /settings        # System status & BCC config
  /api
    /health/db     # Health check
    /inbound/email # Inbound email webhook
    /uploads       # File upload endpoint
    /channels      # Channel CRUD
    /test-email    # Dev email testing
/components
  Sidebar.tsx      # Main navigation
  AppShell.tsx     # Layout wrapper
/prisma
  schema.prisma    # Database schema
```

## Data Models

- **User** - Authenticated users
- **Organization** - Companies/teams
- **Membership** - User ↔ Organization link with role
- **Channel** - Deal tracking channels with unique BCC slug
- **EmailEvent** - Received email records
- **Upload** - File attachments

## Environment Variables

```env
DATABASE_URL="postgresql://channelsignal:channelsignal@localhost:5432/channelsignal?schema=public"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY=""  # Optional in dev - magic links log to console
EMAIL_FROM="onboarding@resend.dev"
STORAGE_PATH="./uploads"
```

## License

MIT
