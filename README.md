# Learnova

Monorepo for Learnova LMS.

## Apps

- `apps/web`: Next.js frontend
- `apps/api`: Express API
- `packages/shared-types`: shared TypeScript contracts

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL (or Supabase Postgres)

## Setup

1. Copy `.env.example` to `.env` in repository root and fill values.
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate -w @learnova/api`
4. Run migrations:
   - `npm run prisma:migrate -w @learnova/api`
5. Seed users:
   - `npm run prisma:seed -w @learnova/api`

## Development

- API: `npm run dev:api`
- Web: `npm run dev:web`

## Health checks

- API health: `GET http://localhost:4000/api/v1/health`
- API DB health: `GET http://localhost:4000/api/v1/health/db`
