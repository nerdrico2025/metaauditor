# Click Auditor

## Overview

Click Auditor is a multi-tenant SaaS for automated auditing of advertising creatives in Meta (Facebook/Instagram) and Google Ads campaigns. The platform uses AI-powered analysis to validate creative compliance with brand guidelines and performance benchmarks, helping marketing teams ensure campaign quality at scale.

## Project Structure

This is a monorepo with 3 independent projects:

### `/server` - Express Backend
- Node.js + Express + TypeScript
- Clean Architecture (Domain-Driven Design)
- JWT authentication with bcrypt password hashing
- PostgreSQL (Neon) database integration
- Handles data persistence and API calls to Meta/Google Ads
- Port: 5000

### `/client` - React Frontend (Vite)
- React 18 + TypeScript + Vite
- TanStack Query for server state management
- Wouter for lightweight routing
- Radix UI + Tailwind CSS for styling
- Separate build output to `/dist/public` for server to serve
- Configuration files: `tailwind.config.ts`, `vite.config.ts`, `postcss.config.js`, `components.json`
- Port: 5173 (dev), served from `/dist/public` (production)

### `/landing` - Next.js Marketing Site
- Next.js standalone landing page
- Separate build and deployment
- Port: 3000
- Fully independent from `/server` and `/client`

## Build Strategy

Each project has independent builds:
```bash
cd landing && npm run build    # Next.js build
cd client && npm run build     # Vite build to /dist/public
cd server && npm run build     # Express build
./build-all.sh                 # Build all at once
```

## Root Configuration Files

⚠️ **Necessary root files for integration:**
- `vite.config.ts` - Required by server/vite.ts for client middleware integration during development
- `postcss.config.js` - PostCSS processing (can be per-project in future)

These are minimal integration points. All actual configuration lives within each project:
- `/client/tailwind.config.ts` - Tailwind configuration
- `/client/components.json` - shadcn/ui configuration  
- `/client/postcss.config.js` - Alternative PostCSS in client
- `/landing/next.config.js` - Next.js configuration
- `/landing/tailwind.config.js` - Next.js Tailwind

## User Preferences

- Preferred communication: Portuguese + simple, everyday language
- Separate builds for each project in production
- Independent development where possible

## Architecture Highlights

- **Frontend-heavy**: Most logic in React client
- **Backend minimal**: Focused on data persistence and external API calls
- **Type-safe**: TypeScript across all projects
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with role-based access control (admin/operator)
- **External integrations**: Meta Marketing API, Google Ads API, Google Cloud Storage
