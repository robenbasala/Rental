import { getDb, sql } from "../config/db.js";
import { ensureCheckoutDraftsTable } from "../db/ensureCheckoutDrafts.js";
import { finalizeOrderPaid } from "./orderFulfillment.js";
import { insertOrderWithItems } from "./orderInsert.js";
import { validateOrderRequest } from "./orderValidation.js";

/**
 * Idempotent: completes payment for legacy sessions (metadata.orderId) or
 * creates order from CheckoutDrafts (metadata.draftId) then finalizes payment.
 */
export async function handleCheckoutSessionCompleted(session) {
  const db = await getDb();
  await ensureCheckoutDraftsTable(db);
  const sessionId = session.id ? String(session.id) : "";

  if (sessionId) {
    const existingOrder = await db.request()
      .input("sid", sql.NVarChar, sessionId)
      .query(`SELECT TOP 1 Id FROM Orders WHERE StripeCheckoutSessionId = @sid`);
    const oid = existingOrder.recordset[0]?.Id;
    if (oid) {
      await finalizeOrderPaid(db, {
        orderId: oid,
        provider: "Stripe",
        providerPaymentId: session.payment_intent || session.id || null,
        currency: session.currency || "usd",
        rawResponse: JSON.stringify(session)
      });
      return;
    }
  }

  const meta = session.metadata || {};
  const legacyOrderId = meta.orderId ? Number(meta.orderId) : 0;
  const draftId = meta.draftId ? String(meta.draftId).trim() : "";

  if (legacyOrderId && Number.isFinite(legacyOrderId) && legacyOrderId > 0 && !draftId) {
    await finalizeOrderPaid(db, {
      orderId: legacyOrderId,
      provider: "Stripe",
      providerPaymentId: session.payment_intent || session.id || null,
      currency: session.currency || "usd",
      rawResponse: JSON.stringify(session)
    });
    return;
  }

  if (!draftId) {
    console.warn("checkout.session.completed: missing draftId and orderId", session.id);
    return;
  }

  const metaUserId = meta.userId != null ? Number(meta.userId) : null;
  if (!Number.isFinite(metaUserId)) {
    console.error("checkout.session.completed: invalid metadata.userId");
    return;
  }

  const draftResult = await db.request()
    .input("id", sql.UniqueIdentifier, draftId)
    .query(`
      SELECT TOP 1 Id, UserId, Payload, ConsumedAt
      FROM CheckoutDrafts
      WHERE Id = @id AND ConsumedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
    `);
  const draft = draftResult.recordset[0];
  if (!draft) {
    console.warn("checkout.session.completed: draft missing or consumed", draftId);
    return;
  }

  if (Number(draft.UserId) !== metaUserId) {
    console.error("checkout.session.completed: user mismatch for draft", draftId);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(draft.Payload);
  } catch {
    console.error("checkout.session.completed: invalid draft payload");
    return;
  }

  const validated = await validateOrderRequest(db, payload);
  const expectedCents = Math.round(Number(validated.quote.total) * 100);
  const paidCents = session.amount_total != null ? Number(session.amount_total) : null;
  if (paidCents != null && paidCents !== expectedCents) {
    console.error("checkout.session.completed: amount mismatch", paidCents, expectedCents, session.id);
    return;
  }

  const order = await insertOrderWithItems(db, draft.UserId, validated, {
    payLater: false,
    stripeCheckoutSessionId: sessionId || null
  });

  await finalizeOrderPaid(db, {
    orderId: order.Id,
    provider: "Stripe",
    providerPaymentId: session.payment_intent || session.id || null,
    currency: session.currency || "usd",
    rawResponse: JSON.stringify(session)
  });

  await db.request()
    .input("id", sql.UniqueIdentifier, draftId)
    .query(`UPDATE CheckoutDrafts SET ConsumedAt = SYSUTCDATETIME() WHERE Id = @id`);
}
