import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { setupVite, serveStatic, log } from "./vite";
import { cronManagerService } from "./src/application/services/CronManagerService";
import { checkIfDatabaseEmpty, seedDatabase } from "../scripts/seedData";
import { errorHandler } from "./src/shared/errors/AppError";
import { storage } from "./src/shared/services/storage.service";

// Import DDD routes
import authRoutes from "./src/presentation/routes/auth.routes";
import userRoutes from "./src/presentation/routes/user.routes"; // Corrected path
import campaignRoutes from "./src/presentation/routes/campaign.routes"; // Corrected path
import creativeRoutes from "./src/presentation/routes/creative.routes"; // Corrected path

// Import legacy routes (será migrado gradualmente)
import { registerRoutes as registerLegacyRoutes } from "./routes";

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
  // Register DDD routes (nova arquitetura)
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/creatives', creativeRoutes);

  // Register legacy routes (ainda necessário para outras rotas)
  const server = await registerLegacyRoutes(app);

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
    log(`serving on port ${PORT}`);

    if (isPreview) {
      log(`🔍 PREVIEW mode detected - skipping heavy operations for faster startup`);
      return;
    }

    setTimeout(async () => {
      try {
        const isEmpty = await checkIfDatabaseEmpty();
        if (isEmpty) {
          log(`🌱 Database is empty - seeding with demo data...`);
          await seedDatabase();
          log(`✅ Database seeded successfully for production demo`);
        }
      } catch (error) {
        console.error(`⚠️ Database seeding failed:`, error);
      }

      if (process.env.NODE_ENV !== 'production') {
        try {
          cronManagerService.startAll(); // Updated to use cronManagerService
          log(`🕐 Google Sheets sync cron jobs started successfully`);
        } catch (error) {
          console.error(`❌ Failed to start cron jobs:`, error);
        }
      } else {
        log(`🚀 Production server ready - cron jobs disabled in production`);
      }

      setTimeout(async () => {
        log(`🔄 Starting production data sync...`);
        try {
          await triggerManualSync();
          log(`✅ Production data sync completed`);
        } catch (error) {
          console.error(`⚠️ Production sync failed:`, error);
        }
      }, 1000);
    }, isPreview ? 0 : 3000);
  });
})();