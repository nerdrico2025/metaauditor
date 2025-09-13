import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cronManager, triggerManualSync } from "./services/cronManager";
import { checkIfDatabaseEmpty, seedDatabase } from "./seedData";

const app = express();

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);

    // Ensure response is sent and don't throw in production
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const PORT = parseInt(process.env.PORT || '5000', 10);

  // Initialize demo user for production - DISABLED TO FIX DATA INCONSISTENCY
  async function initializeDemoUser() {
    // DISABLED: This was causing "Rafael Demo" to appear in production
    // The real user "Rafael Master" exists in the database
    console.log('🚫 Demo user initialization DISABLED in production to prevent data conflicts');
    return;
  }

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

    // Defer heavy operations to allow quick server startup
    setTimeout(async () => {
      // Check if database needs seeding (production environment with empty database)
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

      // Start cron jobs after server is running (only in development)
      if (process.env.NODE_ENV !== 'production') {
        try {
          cronManager.startAll();
          log(`🕐 Google Sheets sync cron jobs started successfully`);
        } catch (error) {
          console.error(`❌ Failed to start cron jobs:`, error);
        }
      } else {
        log(`🚀 Production server ready - cron jobs disabled in production`);
      }

      // Production startup - sync data only, NO demo user bootstrap
      setTimeout(async () => {
        // REMOVED: await initializeDemoUser() - was causing Rafael Demo to appear
        
        // Force sync to ensure production user sees all data
        log(`🔄 Starting production data sync...`);
        try {
          await triggerManualSync();
          log(`✅ Production data sync completed`);
        } catch (error) {
          console.error(`⚠️ Production sync failed:`, error);
        }
      }, 1000);
    }, isPreview ? 0 : 3000); // No delay for preview, 3s delay for normal startup
  });
})();