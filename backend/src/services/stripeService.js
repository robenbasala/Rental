import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.stripeSecretKey);

export async function createCheckoutSession({ draftId, userId, amount, customerEmail }) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripeCurrency,
          product_data: { name: "Party rental checkout" },
          unit_amount: Math.round(Number(amount) * 100)
        }
      }
    ],
    metadata: {
      draftId: String(draftId),
      userId: String(userId)
    },
    success_url: `${env.frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.frontendUrl}/checkout?cancelled=1&draftId=${encodeURIComponent(String(draftId))}`
  });
}
