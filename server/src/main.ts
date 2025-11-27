          import express from "express";
          import cors from "cors";
          import { cronOrchestratorService } from "./infrastructure/services/CronOrchestratorService.js";
          import { checkIfDatabaseEmpty, seedDatabase } from "../scripts/seedData.js";
          import { errorHandler } from "./shared/errors/AppException.js";
          import { storage } from "./shared/services/storage.service.js";
          import path from "path";
          import fs from "fs";

          // Import DDD routes
          import authRoutes from "./presentation/routes/auth.routes.js";
          import userRoutes from "./presentation/routes/user.routes.js";
          import usersRouter from "./presentation/routes/users.routes.js";
          import campaignRoutes from "./presentation/routes/campaign.routes.js";
          import adSetRoutes from "./presentation/routes/adset.routes.js";
          import creativeRoutes from "./presentation/routes/creative.routes.js";
          import policyRoutes from "./presentation/routes/policy.routes.js";
          import integrationRoutes from "./presentation/routes/integration.routes.js";
          import dashboardRoutes from "./presentation/routes/dashboard.routes.js";
          import auditRoutes from "./presentation/routes/audit.routes.js";
          import companyRoutes from "./presentation/routes/company.routes.js";
          import sheetsRoutes from "./presentation/routes/sheets.routes.js";
          import imageMigrationRoutes from "./presentation/routes/image-migration.routes.js";
          import platformSettingsRoutes from "./presentation/routes/platform-settings.routes.js";
          import metaOAuthRoutes from "./presentation/routes/meta-oauth.routes.js";
          import adminRoutes from "./presentation/routes/admin.routes.js";
          import plansRoutes from "./presentation/routes/plans.routes.js";

          export async function startServer() {
            const app = express();

            // Setup storage in app locals for middleware access
            app.locals.storage = storage;

            // CORS configuration
            app.use(
              cors({
                origin:
                  process.env.NODE_ENV === "development"
                    ? ["http://localhost:5173", "http://localhost:5000"]
                    : true,
                credentials: true,
              })
            );

            app.use(express.json());
            app.use(express.urlencoded({ extended: false }));

            // Static uploads
            app.use("/uploads", express.static("server/public/uploads"));

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

                  console.log(logLine);
                }
              });

              next();
            });

            // Register DDD routes
            app.use("/api/auth", authRoutes);
            app.use("/api/users", usersRouter);
            app.use("/api/campaigns", campaignRoutes);
            app.use("/api/adsets", adSetRoutes);
            app.use("/api/creatives", creativeRoutes);
            app.use("/api/policies", policyRoutes);
            app.use("/api/integrations", integrationRoutes);
            app.use("/api/dashboard", dashboardRoutes);
            app.use("/api/audits", auditRoutes);
            app.use("/api/company", companyRoutes);
            app.use("/api/plans", plansRoutes);

            // Webhook routes (no authentication)
            const webhookRoutes = (
              await import("./presentation/routes/webhook.routes.js")
            ).default;
            app.use("/api/webhooks", webhookRoutes);
            app.use("/api", sheetsRoutes);
            app.use("/api/admin", adminRoutes);
            app.use("/api/image-migration", imageMigrationRoutes);
            app.use("/api/platform-settings", platformSettingsRoutes);
            app.use("/api/auth/meta", metaOAuthRoutes);

            // Health check endpoints
            app.get("/healthz", (req, res) => {
              res
                .status(200)
                .json({ status: "ok", timestamp: new Date().toISOString() });
            });

            app.head("/healthz", (req, res) => res.status(200).end());
            app.head("/api", (req, res) => res.status(200).end());

            // Global error handler
            app.use(errorHandler);

            // If production: serve the client build
            if (process.env.NODE_ENV === "production") {
              const possiblePaths = [
                path.resolve(process.cwd(), "client/dist"),
                path.resolve(process.cwd(), "dist/public"),
                path.resolve(process.cwd(), "../client/dist"),
              ];
              
              const clientDist = possiblePaths.find(p => fs.existsSync(p));

              if (clientDist) {
                console.log("✅ Serving client from:", clientDist);
                app.use(express.static(clientDist));
                app.get("*", (req, res) => {
                  res.sendFile(path.join(clientDist, "index.html"));
                });
              } else {
                console.warn(
                  "⚠️ Client build not found. Searched:",
                  possiblePaths.join(", "),
                  "\nRun: npm run build:client"
                );
              }
            }

            const PORT = parseInt(process.env.PORT || "5000", 10);

            return new Promise<void>((resolve) => {
              app.listen(PORT, "0.0.0.0", async () => {
                console.log(`🚀 Server running on port ${PORT}`);

                const isPreview =
                  process.env.REPLIT_PREVIEW === "true" ||
                  process.env.REPLIT_DEPLOYMENT === "preview";

                if (!isPreview) {
                  // Seed database if empty
                  try {
                    const isEmpty = await checkIfDatabaseEmpty();
                    if (isEmpty) {
                      console.log("🌱 Seeding database...");
                      await seedDatabase();
                      console.log("✅ Database seeded successfully");
                    }
                  } catch (error) {
                    console.error("⚠️ Database seeding failed:", error);
                  }

                  // Start cron jobs (only in dev)
                  if (process.env.NODE_ENV !== "production") {
                    try {
                      cronOrchestratorService.setupCronJobs();
                      cronOrchestratorService.startAll();
                      console.log("🕐 Cron jobs started");
                    } catch (error) {
                      console.error("❌ Failed to start cron jobs:", error);
                    }
                  }
                }

                resolve();
              });
            });
          }

          // Start the server when executed directly
          startServer().catch((error) => {
            console.error("❌ Failed to start server:", error);
            process.exit(1);
          });
