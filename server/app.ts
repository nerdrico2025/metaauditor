
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { errorHandler } from "./core/errors/errorHandler";
import authRoutes from "./modules/auth/auth.routes";

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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// API Routes - Modular structure
import userRoutes from "./modules/users/user.routes";
import campaignRoutes from "./modules/campaigns/campaign.routes";
import creativeRoutes from "./modules/creatives/creative.routes";

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

// Global error handler (must be last)
app.use(errorHandler);

export default app;
