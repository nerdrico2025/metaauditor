
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { setupVite, serveStatic, log } from "./vite";
import { cronManagerService } from "./src/application/services/CronManagerService";
import { checkIfDatabaseEmpty, seedDatabase } from "../scripts/seedData";
import { errorHandler } from "./src/shared/errors/AppError";
import { storage } from "./src/shared/services/storage.service";

// Import DDD routes
import authRoutes from "./src/presentation/routes/auth.routes";
import userRoutes from "./src/presentation/routes/user.routes";
import campaignRoutes from "./src/presentation/routes/campaign.routes";
import creativeRoutes from "./src/presentation/routes/creative.routes";

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

(async () => {
  const server = require('http').createServer(app);

  // Register DDD routes (nova arquitetura)
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/creatives', creativeRoutes);

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

  // Global error handler (DDD)
  app.use(errorHandler);

  // Vite setup
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  const isPreview = process.env.REPLIT_PREVIEW === 'true' || process.env.REPLIT_DEPLOYMENT === 'preview';

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
          cronManagerService.startAll();
          log(`🕐 Cron jobs started`);
        } catch (error) {
          console.error(`❌ Failed to start cron jobs:`, error);
        }
      } else {
        log(`🚀 Production mode - cron jobs disabled`);
      }
    }, isPreview ? 0 : 3000);
  });
})();
