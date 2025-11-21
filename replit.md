# Click Auditor

## Overview
Click Auditor is a cloud-based SaaS platform designed to automate the auditing of digital campaign creatives (images, texts, banners, etc.) across Meta (Facebook/Instagram) and Google Ads. It leverages AI to ensure brand compliance, identify high and low-performing creatives based on customizable criteria, and offers automated pausing capabilities for underperforming content. The project's ambition is to provide an enterprise-grade solution for efficient creative auditing and campaign optimization.

## User Preferences
Preferred communication style: Simple, everyday language.
Deployment strategy: Separate deployments for landing and app to minimize impact of changes.

## System Architecture
Click Auditor is a full-stack TypeScript application utilizing a monorepo architecture. It features two distinct frontends (a public landing page and a restricted SaaS application) and a shared backend, enabling independent deployment and focused development.

### Monorepo Structure
- `/server`: Express.js backend API.
- `/client`: React Vite frontend for the SaaS application.
- `/landing`: Next.js 14 frontend for the public landing page and pricing.
- `/shared`: Contains shared TypeScript schemas and types.
- `/migrations`: Database migration files.

### Multi-Frontend Architecture
- **Landing Page (`/landing`)**: A standalone Next.js project optimized for performance and SEO, handling the homepage, features, plans, and pricing, with redirection to the app's login.
- **SaaS Application (`/client`)**: A React Vite application with protected authentication, featuring dashboards, campaign and creative management, reporting, policy configuration, and integration interfaces.

### Key Technologies
- **Frontend**: React 18, Vite, Wouter for routing, TanStack Query for state management, Radix UI with shadcn/ui for components, Tailwind CSS for styling, React Hook Form with Zod for forms.
- **Backend**: Node.js, Express.js, TypeScript, PostgreSQL with Drizzle ORM, Replit Auth for authentication (OpenID Connect), Express sessions.
- **Data Storage**: PostgreSQL (Neon serverless compatible) managed with Drizzle ORM.

### Core Features
- **Dashboard**: Overview of campaign metrics.
- **Campaigns & Creatives**: Management and analysis of advertising assets.
- **Reports**: Detailed audit analytics.
- **Policies**: Configuration of brand compliance rules and performance thresholds.
- **Integrations**: Connecting to ad platforms like Meta Ads and Google Ads.
- **AI Analysis**: Utilization of OpenAI GPT-4o for creative auditing and compliance checks.
- **Meta Webhooks**: Real-time synchronization of campaign and creative data from Meta.

### Data Flow
1. **Authentication**: Users log in via Replit Auth.
2. **Platform Integration**: Secure connection to Meta/Google APIs.
3. **Data Sync**: Automated daily synchronization or real-time updates via webhooks (Meta) of campaigns and creatives.
4. **AI Analysis**: OpenAI GPT-4o processes creatives for compliance and performance.
5. **Audit Results**: Stores results and recommendations in the database.
6. **User Actions**: Allows users to review and approve automated actions, such as pausing campaigns.

## External Dependencies

### AI Services
- **OpenAI API**: Utilizes GPT-4o for creative analysis, compliance checking, and performance scoring. Includes image analysis capabilities for logo detection, color analysis, and text extraction.

### Ad Platform APIs
- **Meta Ads Manager API**: For synchronizing campaign, ad set, and creative data from Facebook/Instagram.
- **Google Campaign Manager API**: For synchronizing campaign and creative data from Google Ads.
- **OAuth2**: Used for secure authentication and authorization with ad platforms.

### Infrastructure Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit Auth**: Provides authentication and user management services.
- **WebSocket**: Used for real-time status updates (e.g., sync progress).