# ChannelSignal

Email-native sales intelligence for multi-org channel reps. Ingests BCC'd emails to auto-track deals, contacts, and organizations — then generates actionable reports.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start database
docker compose up -d

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
pnpm db:migrate

# Start dev server
pnpm dev
```

## Features

- **BCC Email Tracking**: Unique BCC address per user for automatic email ingestion
- **Contact & Org Extraction**: Automatically extracts organizations and contacts from emails
- **File Uploads**: Upload supporting documents, presentations, and notes
- **Weekly Reports**: Generated summaries of email activity, new contacts, and deals
- **Meeting Briefs**: Pre-meeting intelligence for QBRs, reviews, and check-ins

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma
- **Auth**: NextAuth.js with email magic links
- **Styling**: Tailwind CSS

## Project Structure

```
/app                  # Next.js App Router pages
/app/api              # API routes (webhooks, REST endpoints)
/lib
  /db                 # Prisma client
  /auth               # NextAuth configuration
  /ingestion          # Email parsing and processing
  /reports            # Report generation
  /services           # Storage and other services
/prisma
  schema.prisma       # Database schema
/components           # React components
```

## Environment Variables

See `.env.example` for required configuration:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Session encryption key
- `EMAIL_SERVER_*` - SMTP configuration for magic links
- `INBOUND_EMAIL_DOMAIN` - Domain for BCC addresses

## API Endpoints

### Inbound Email Webhook
```
POST /api/inbound-email
```
Receives emails from inbound email providers (Resend, Postmark, etc.)

### Reports
```
GET  /api/reports           # List reports
GET  /api/reports/:id       # Get specific report
POST /api/reports/weekly    # Generate weekly report
POST /api/reports/meeting-brief  # Generate meeting brief
```

### Artifacts
```
GET  /api/artifacts         # List uploaded files
POST /api/artifacts         # Upload a file
```

### Meetings
```
GET  /api/meetings          # List detected meetings
```

## Development

```bash
# Run dev server
pnpm dev

# Database management
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema changes
pnpm db:studio    # Open Prisma Studio

# Linting
pnpm lint
```

## License

MIT
