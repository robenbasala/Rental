import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";

const app = express();

const corsOrigins =
  env.nodeEnv === "production"
    ? env.frontendUrl
    : [...new Set([env.frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean))];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
