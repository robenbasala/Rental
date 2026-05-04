import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "replace_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE,
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false"
    }
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeCurrency: process.env.STRIPE_CURRENCY || "usd",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  businessAddress: process.env.BUSINESS_ADDRESS || "25 Monroe Ave, Toms River, NJ 08755",
  emailProvider: process.env.EMAIL_PROVIDER || "sendgrid",
  sendGridApiKey: process.env.SENDGRID_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "no-reply@example.com",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
};
