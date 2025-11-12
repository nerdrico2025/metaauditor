# Click Auditor - Ferramenta de Auditoria Automática de Criativos

## Overview

Click Auditor is a cloud-based web application that automates the auditing of creatives (images, texts, banners, etc.) in digital campaigns on Meta (Facebook/Instagram) and Google Ads. The system uses AI to validate brand compliance and identify high/low-performing creatives based on customizable criteria, with automated pausing capabilities for underperforming content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

This is a full-stack TypeScript application using a modern React frontend with an Express.js backend. The architecture follows a monorepo structure with clear separation between client, server, and shared code.

### Directory Structure
- `/client` - React frontend with Vite build system
- `/server` - Express.js backend API
- `/shared` - Shared TypeScript schemas and types
- `/migrations` - Database migration files

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Routing**: Wouter for lightweight client-side routing  
- **State Management**: TanStack Query for server state
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation

### Application Pages
- **Dashboard**: Campaign metrics and performance overview
- **Campaigns**: Campaign management and monitoring
- **Creatives**: Creative analysis and audit results
- **Reports**: Detailed audit reports and analytics
- **Policies**: Brand compliance rules configuration
- **History**: Audit history and action logs
- **Integrations**: Ad account connection interface (Meta/Google Ads)

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL store
- **API Structure**: RESTful endpoints with proper error handling

### Data Storage
- **Primary Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle with type-safe queries and migrations
- **Session Storage**: PostgreSQL table-based sessions
- **Schema Location**: `/shared/schema.ts` with Zod validation schemas

## Data Flow

1. **Authentication Flow**: Users authenticate via Replit Auth (OIDC)
2. **Platform Integration**: System connects to Meta/Google APIs using stored credentials
3. **Data Sync**: Automated daily sync of campaigns and creatives from ad platforms
4. **AI Analysis**: OpenAI GPT-4o analyzes creatives for compliance and performance
5. **Audit Results**: Results stored in database with actionable recommendations
6. **User Actions**: Users can review and approve automated actions (pause campaigns)

### Core Data Models
- **Users**: Profile and authentication data
- **Integrations**: Platform API credentials and sync status
- **Campaigns**: Campaign metadata from ad platforms
- **Creatives**: Individual ad creatives with performance metrics
- **Policies**: Brand compliance rules and performance thresholds
- **Audits**: AI analysis results with compliance/performance scores
- **Audit Actions**: Automated actions taken on creatives

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model for creative analysis and compliance checking
- **Image Analysis**: AI-powered logo detection, color analysis, and text extraction

### Ad Platform APIs
- **Meta Ads Manager**: Campaign and creative data synchronization
- **Google Campaign Manager**: Campaign and creative data synchronization
- **Authentication**: OAuth2 flows for platform access

### Infrastructure Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Auth**: Authentication and user management
- **WebSocket**: Real-time sync status updates

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express backend
- **Hot Reload**: Full-stack hot module replacement
- **Database**: Connection to remote Neon PostgreSQL instance

### Production Build
- **Frontend**: Vite production build to `/dist/public`
- **Backend**: esbuild compilation to `/dist/index.js`
- **Static Serving**: Express serves built frontend assets
- **Environment**: NODE_ENV-based configuration

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: AI analysis service
- `REPL_ID` & `ISSUER_URL`: Replit authentication
- `SESSION_SECRET`: Session encryption key

### Scalability Considerations
- Serverless-friendly architecture with Neon PostgreSQL
- Stateless server design with database-backed sessions
- Queue-based processing for large-scale creative analysis
- Configurable sync intervals to manage API rate limits

The system is designed to handle enterprise-scale creative auditing with automated compliance checking, performance monitoring, and intelligent recommendations for campaign optimization.

## Recent Updates (January 2025)

### Image Storage & Data Deletion (November 7, 2025)
- Fixed SQL error when deleting integrations (switched from `ANY` to `inArray`)
- Implemented automatic image file deletion when creatives are removed
- Reverted to local image storage: downloads images from Meta API and saves to `/uploads/creatives/`
- Images are now permanently stored locally (no expiration issues)
- When deleting integration with "Delete all data", associated image files are automatically removed from filesystem

### Complete Meta Ads Hierarchy Integration (Completed - November 6, 2025)
- Implemented **full Meta advertising hierarchy**: Account → Campaign → Ad Set → Ad (4 levels)
- Created comprehensive `ad_sets` table in database schema with all required fields
- Updated `creatives` table to reference `ad_set_id` instead of direct campaign linkage
- Enhanced MetaAdsService with complete hierarchy support:
  - `syncCampaigns()` - Fetch all campaigns from Meta account
  - `syncAdSets()` - Fetch ad sets for each campaign
  - `syncCreatives()` - Fetch ads (creatives) for each ad set
  - Full insights and performance metrics for all levels
- Implemented storage service CRUD methods for ad sets:
  - `createAdSet()`, `getAdSetsByUser()`, `getAdSetsByCampaign()`
  - `getAdSetById()`, `updateAdSet()`
- Updated sync route (POST /api/integrations/:id/sync) to handle 3-level synchronization:
  1. Sync campaigns from Meta account
  2. For each campaign, sync its ad sets
  3. For each ad set, sync its ads (creatives)
- Added detailed console logging throughout sync process for monitoring
- Multi-tenant architecture: Each company has its own tokens stored securely
- Validates images before AI analysis - blocks placeholder images
- Real-time sync status with last sync timestamp display
- API response includes counts: campaigns, adSets, and creatives synced

### Platform Integration System (Completed - November 6, 2025)
- Full Meta Ads and Google Ads integration with company-level token storage
- Created GoogleAdsService for Google Ads campaign and ad synchronization
- Built comprehensive API routes for integration management (/api/integrations)
  - POST / - Create new integration with access tokens
  - GET /:id - Get integration details
  - PUT /:id - Update integration credentials
  - DELETE /:id - Remove integration
  - POST /:id/sync - Sync campaigns and creatives from platform
  - POST /:id/validate - Validate access token
  - GET /meta/accounts - Get Meta ad accounts
  - GET /google/accounts - Get Google customer accounts
- Added "Integrações" tab in Settings page with full UI for:
  - Creating integrations with platform selection
  - Viewing all configured integrations
  - Syncing data with one-click refresh
  - Removing integrations

### Simplified Policies Page (Completed - September 13, 2025)
- Replaced complex multi-policy interface with unified settings page
- New simplified two-tab interface: "Políticas de Marca" and "Critérios de Validação"  
- Consolidated three separate pages (Brand Settings, Policies, Content Criteria) into single interface
- Implemented ChipsInput component for managing keywords and terms
- Added atomic database transactions for consistent updates across tables
- All brand policies and validation criteria now managed in one unified interface

### Color Palette Update (Completed - January 31, 2025)
- Successfully migrated entire application to Click Hero brand colors
- Updated CSS variables and Tailwind configuration with:
  - Orange (#cf6f03) for primary actions and branding
  - Black (#0c0d0a) for primary text with high contrast
  - White (#ecedef) for primary backgrounds
  - Dark Gray (#2a2a2a) for secondary text and elements
  - White 2 (#e6e7e9) for subtle backgrounds and hover states
- Converted all components to use semantic color tokens for consistency
- Maintained WCAG AA compliance throughout the application

### Test User Environment (Completed - January 31, 2025)
- Created comprehensive test user for Facebook audit verification:
  - Email: usuario.teste@clickauditor-demo.com
  - Password: TesteFacebook2025!
  - Complete sample data including Meta and Google integrations
  - Sample campaigns, creatives, policies, and audit results
  - Full access to all application features and functionality

### Ad Account Integration Interface (Completed)
- Created comprehensive integration page for connecting Meta and Google Ads accounts
- Built modal interface with step-by-step credential instructions
- Implemented CRUD operations for integration management (create, update, delete, sync)
- Added visual status indicators and validation for platform connections
- Enhanced API routes with proper authentication and error handling

### AI Analysis Testing (Functional)
- Developed complete AI testing interface for validating GPT-4o analysis
- Implemented sample data generation for testing creative compliance
- Created performance scoring and recommendation systems
- Validated OpenAI API integration with real analysis results

### Core Application Status
- Authentication system fully functional with Replit Auth
- Database schema complete with PostgreSQL integration
- All main pages implemented with proper routing
- UI components library established with shadcn/ui
- Backend API routes operational with proper validation
- Platform integrations (Meta Ads & Google Ads) fully operational
- Multi-tenant SaaS architecture with company-level isolation
- Creative synchronization from ad platforms working
- Campaign import from Meta and Google functional

## Meta Webhooks Implementation (November 12, 2025)

### Overview
Implemented Meta Webhooks to enable real-time campaign and creative synchronization, eliminating rate limiting issues from polling-based sync.

### Infrastructure
- **Database Table**: `webhook_events` table tracks all webhook notifications
  - Fields: id, integrationId, eventType, objectId, objectType, payload, processed, processedAt, receivedAt, error
- **Routes**: 
  - GET `/api/webhooks/meta` - Webhook verification endpoint for Meta setup
  - POST `/api/webhooks/meta` - Receives webhook notifications from Meta
- **Security**: SHA-256 signature verification using Meta App Secret
- **Processing**: Automatic updates to campaigns, ad sets, and creatives based on webhook events

### Webhook Configuration in Meta Business Manager

To enable webhooks for your Meta integration:

1. **Access Meta for Developers**: Go to https://developers.facebook.com/apps/
2. **Select Your App**: Choose the app connected to Click Auditor
3. **Navigate to Webhooks**: In left sidebar, click "Webhooks"
4. **Configure Ad Account Webhooks**:
   - Click "Edit" for Ad Account subscription
   - Callback URL: `https://[YOUR-REPLIT-URL]/api/webhooks/meta`
   - Verify Token: `click_auditor_meta_webhook_2025` (configured in webhook.routes.ts)
   - Click "Verify and Save"

5. **Subscribe to Fields**:
   - Navigate to "Webhook Fields" for Ad Account
   - Subscribe to these fields:
     - `ads` - Notifies when ads (creatives) are created, updated, or deleted
     - `adsets` - Notifies when ad sets change status or settings
     - `campaigns` - Notifies when campaigns are modified
     - `adaccount` - Notifies about account-level changes

6. **Test Webhook**:
   - Use "Test" button in Meta Webhooks console
   - Check webhook_events table in database for received events
   - Verify processedAt timestamp and processed=true status

### Supported Webhook Events

| Event Type | Object Type | Action |
|-----------|-------------|--------|
| UPDATE | campaign | Update campaign status, name, budget in database |
| UPDATE | adset | Update ad set status, targeting, budget |
| UPDATE | ad | Update creative status, text, images |
| CREATE | ad | Sync new creative to database |
| DELETE | ad | Mark creative as deleted |

### Environment Variables Required
- `META_APP_SECRET`: Your Meta App Secret for signature verification (auto-retrieved from integration tokens)

### Monitoring
- All webhook events are logged to `webhook_events` table
- Failed events store error messages in `error` field
- Use admin panel to view webhook history and retry failed events