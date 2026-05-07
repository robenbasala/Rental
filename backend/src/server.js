import app from "./app.js";
import { env } from "./config/env.js";
import { getDb } from "./config/db.js";
import { ensureOrderItemsPackageColumns } from "./db/ensureOrderItemsPackages.js";
import { ensureCheckoutDraftsTable } from "./db/ensureCheckoutDrafts.js";
import { stripe } from "./services/stripeService.js";
import { handleCheckoutSessionCompleted } from "./services/stripeCheckoutComplete.js";

app.post("/api/payments/webhook", async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], env.stripeWebhookSecret);
  } catch (err) {
    const allowUnsigned =
      env.nodeEnv === "development" &&
      env.stripeWebhookBypassDev &&
      Buffer.isBuffer(req.body);
    if (allowUnsigned) {
      try {
        event = JSON.parse(req.body.toString("utf8"));
        if (!event?.type) throw new Error("missing event.type");
        console.warn("Stripe webhook: STRIPE_WEBHOOK_BYPASS_DEV=1 — parsed body without signature (local only).");
      } catch {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      await handleCheckoutSessionCompleted(session);
    } catch (err) {
      console.error("Webhook checkout.session.completed error", err);
    }
  }

  res.json({ received: true });
});

async function start() {
  try {
    const db = await getDb();
    await ensureOrderItemsPackageColumns(db);
    console.log("OrderItems package columns OK.");
    await ensureCheckoutDraftsTable(db);
    console.log("CheckoutDrafts table OK.");
  } catch (err) {
    console.error("Startup schema ensure failed:", err.message || err);
  }

  app.listen(env.port, () => {
    console.log(`API server running on http://localhost:${env.port}`);
    if (env.nodeEnv === "development" && env.stripeWebhookBypassDev) {
      console.warn("STRIPE_WEBHOOK_BYPASS_DEV=1: webhooks accept unsigned JSON in development if signature fails.");
    }
  });
}

start();
