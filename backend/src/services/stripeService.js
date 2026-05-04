import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.stripeSecretKey);

export async function createCheckoutSession({
  orderId,
  amount,
  customerEmail
}) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripeCurrency,
          product_data: { name: `Rental Order #${orderId}` },
          unit_amount: Math.round(amount * 100)
        }
      }
    ],
    metadata: { orderId: String(orderId) },
    success_url: `${env.frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.frontendUrl}/checkout?cancelled=1`
  });
}
