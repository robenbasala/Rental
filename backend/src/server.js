import app from "./app.js";
import { env } from "./config/env.js";
import { getDb } from "./config/db.js";
import { stripe } from "./services/stripeService.js";
import { finalizeOrderPaid } from "./services/orderFulfillment.js";

app.post("/api/payments/webhook", async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], env.stripeWebhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = Number(session?.metadata?.orderId || 0);
    if (orderId) {
      try {
        const db = await getDb();
        await finalizeOrderPaid(db, {
          orderId,
          provider: "Stripe",
          providerPaymentId: session.payment_intent || session.id || null,
          currency: session.currency || "usd",
          rawResponse: JSON.stringify(session)
        });
      } catch (err) {
        console.error("Webhook finalize error", err);
      }
    }
  }

  res.json({ received: true });
});

app.listen(env.port, () => {
  console.log(`API server running on http://localhost:${env.port}`);
});
