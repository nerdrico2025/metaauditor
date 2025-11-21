# Click Auditor

## Overview

Click Auditor is a full-stack web application for automated auditing of advertising creatives in Meta (Facebook/Instagram) and Google Ads campaigns. The platform uses AI-powered analysis to validate creative compliance with brand guidelines and performance benchmarks, helping marketing teams ensure campaign quality at scale.

The application enables users to:
- Connect and sync campaigns from Meta and Google Ads platforms
- Automatically analyze creative assets (images, text, videos) for brand compliance
- Monitor performance metrics and identify underperforming creatives
- Generate compliance reports and audit history
- Configure brand policies and validation criteria
- Manage multi-level user access (admin and operator roles)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type safety
- Vite as build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching
- Radix UI components for accessible, composable UI primitives
- Tailwind CSS for utility-first styling with custom Click Hero brand colors

**Design Decisions:**
- Component-based architecture with reusable UI components in `/src/components`
- Page-based routing structure in `/src/pages` matching application features
- Context API for global authentication state management
- Custom theme system using CSS variables for consistent branding across light/dark modes
- Form validation using react-hook-form with zod resolvers for type-safe validation

**State Management:**
- TanStack Query handles all server state with automatic caching, refetching, and optimistic updates
- AuthContext manages authentication state (user, token, role)
- Local component state for UI interactions

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js and TypeScript
- Clean Architecture pattern with domain-driven design principles
- Layered structure: Domain → Application → Infrastructure → Presentation

**Architectural Layers:**
1. **Domain Layer** (`/src/domain`): Core business entities and interfaces
2. **Application Layer** (`/src/application`): Use cases and business logic
3. **Infrastructure Layer** (`/src/infrastructure`): External services, database, APIs
4. **Presentation Layer** (`/src/presentation`): HTTP routes, middleware, controllers

**Key Design Patterns:**
- Repository pattern for data access abstraction
- Service layer for business logic encapsulation
- Middleware pattern for cross-cutting concerns (auth, logging, error handling)
- Dependency injection for testability and loose coupling

**API Design:**
- RESTful API endpoints with consistent naming conventions
- JWT-based authentication with bcrypt password hashing
- Role-based access control (admin vs operator levels)
- Comprehensive error handling with structured error responses
- Request/response logging for debugging and audit trails

### Data Storage

**Database:**
- PostgreSQL as primary relational database
- Neon Database (serverless Postgres) for cloud hosting
- Drizzle ORM for type-safe database queries and migrations

**Schema Design:**
- Users table with role-based access control
- Campaigns, AdSets, and Creatives hierarchy matching platform structures
- Audits table for tracking analysis results and compliance scores
- Policies and criteria tables for configurable brand rules
- Metrics tables for performance data from advertising platforms
- Integration tokens table for secure credential storage

**Data Migration Strategy:**
- Drizzle Kit for schema migrations
- Versioned migration files in `/drizzle/migrations`
- Separate schema definition in `/drizzle/schema.ts`

### Authentication & Authorization

**Authentication Mechanism:**
- Custom JWT-based authentication system
- Password hashing using bcrypt with salt rounds
- Token stored in localStorage on client side
- Token validation middleware on protected routes

**Authorization Levels:**
- **Administrator**: Full access including user management, policy configuration, and all features
- **Operator**: Limited to campaign viewing, creative analysis, and reports (no user/policy management)
- Master user (`rafael@clickhero.com.br`) with immutable admin privileges

**Security Measures:**
- Secure password storage with bcrypt hashing
- JWT token expiration and refresh mechanisms
- Role-based endpoint protection at middleware level
- CORS configuration for cross-origin requests
- Environment-based security settings (development vs production)

### External Dependencies

**Advertising Platform APIs:**
- **Meta Marketing API**: For syncing campaigns, ad sets, ads, and performance metrics from Facebook/Instagram
- **Google Ads API**: For syncing Google Ads campaigns and creatives
- Rate limiting and retry logic for API reliability
- OAuth token management for platform authentication
- Batch processing for large data volumes

**Cloud Services:**
- **Google Cloud Storage**: For storing creative assets (images, videos)
- Upload service with signed URLs for secure access
- Asset proxy for serving external images through application

**AI/ML Services:**
- Custom AI analysis service for creative compliance validation
- Image analysis for logo detection, color validation, and visual quality
- Text analysis for keyword compliance and prohibited terms detection
- Performance scoring based on configurable benchmarks

**Background Jobs:**
- Node-cron for scheduled tasks
- Daily sync jobs for campaign and metrics updates
- Health check jobs for system monitoring
- Configurable sync intervals (daily at 8 AM, optional 30-minute intervals in development)

**Development Tools:**
- Replit Cloud for hosting and deployment
- Vite runtime error overlay for development debugging
- TypeScript for type safety across frontend and backend
- ESLint and Prettier for code quality (configuration present)

**Key Integrations:**
- Single-tab Google Sheets sync for importing campaign metrics
- Image proxy service for Facebook/Instagram creative thumbnails
- Audit logging for compliance tracking
- Multi-tab data synchronization capabilities