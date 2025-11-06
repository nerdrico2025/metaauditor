import express from "express";
import cors from "cors";
import { setupVite, serveStatic, log } from "../vite.js";
import { cronOrchestratorService } from "./infrastructure/services/CronOrchestratorService.js";
import { checkIfDatabaseEmpty, seedDatabase } from "../scripts/seedData.js";
import { errorHandler } from "./shared/errors/AppException.js";
import { storage } from "./shared/services/storage.service.js";

// Import DDD routes
import authRoutes from "./presentation/routes/auth.routes.js";
import userRoutes from "./presentation/routes/user.routes.js";
import campaignRoutes from "./presentation/routes/campaign.routes.js";
import creativeRoutes from "./presentation/routes/creative.routes.js";
import policyRoutes from "./presentation/routes/policy.routes.js";
import integrationRoutes from "./presentation/routes/integration.routes.js";
import dashboardRoutes from "./presentation/routes/dashboard.routes.js";
import auditRoutes from "./presentation/routes/audit.routes.js";

export async function startServer() {
  const app = express();

  // Setup storage in app locals for middleware access
  app.locals.storage = storage;

  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'development'
      ? ['http://localhost:5000', 'http://0.0.0.0:5000']
      : true,
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  const { createServer } = await import('http');
  const server = createServer(app);

  // Register DDD routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/creatives', creativeRoutes);
  app.use('/api/policies', policyRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audits', auditRoutes);

  // Health check endpoints
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.head('/healthz', (req, res) => {
    res.status(200).end();
  });

  app.head('/api', (req, res) => {
    res.status(200).end();
  });

  // Global error handler
  app.use(errorHandler);

  // Vite setup
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  const isPreview = process.env.REPLIT_PREVIEW === 'true' || process.env.REPLIT_DEPLOYMENT === 'preview';

  return new Promise<void>((resolve) => {
    server.listen({
      port: PORT,
      host: "0.0.0.0",
      reusePort: true,
    }, async () => {
      log(`🚀 Server running on port ${PORT}`);
      log(`📐 Architecture: Domain-Driven Design (DDD)`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

      if (isPreview) {
        log(`🔍 PREVIEW mode - skipping heavy operations`);
        resolve();
        return;
      }

      setTimeout(async () => {
        try {
          const isEmpty = await checkIfDatabaseEmpty();
          if (isEmpty) {
            log(`🌱 Seeding database...`);
            await seedDatabase();
            log(`✅ Database seeded successfully`);
          }
        } catch (error) {
          console.error(`⚠️ Database seeding failed:`, error);
        }

        if (process.env.NODE_ENV !== 'production') {
          try {
            // Setup cron jobs
            cronOrchestratorService.setupCronJobs();
            log("✅ Cron jobs configured");
            cronOrchestratorService.startAll();
            log(`🕐 Cron jobs started`);
          } catch (error) {
            console.error(`❌ Failed to start cron jobs:`, error);
          }
        } else {
          log(`🚀 Production mode - cron jobs disabled`);
        }

        resolve();
      }, isPreview ? 0 : 3000);
    });
  });
}

// Start the server when this module is executed directly
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});