/**
 * Runs `stripe listen --forward-to` with STRIPE_API_KEY from ../.env when the key is sk_test_*.
 * Stripe CLI refuses sk_live_*; use Dashboard test webhooks or verify-session fallback instead.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
let sk = "";
try {
  const raw = fs.readFileSync(envPath, "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("STRIPE_SECRET_KEY="));
  sk = line ? line.split("=", 2)[1].trim().replace(/^["']|["']$/g, "") : "";
} catch {
  console.error("Could not read backend/.env");
  process.exit(1);
}

const forward = "http://localhost:4000/api/payments/webhook";

if (sk.startsWith("sk_test_")) {
  const child = spawn("stripe", ["listen", "--forward-to", forward], {
    stdio: "inherit",
    env: { ...process.env, STRIPE_API_KEY: sk }
  });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  console.log(`
Stripe CLI cannot use sk_live_* keys.

You already have STRIPE_WEBHOOK_BYPASS_DEV=1 in .env: forwarded webhooks whose signature
fails will still be parsed in development (see server.js).

Options:
  1) Add a test secret key (sk_test_...) to backend/.env for local checkout, then run:
       npm run stripe:listen
  2) Or run once in a terminal:  stripe login
     then:  npm run stripe:listen
  3) Or rely on Pay Now success + POST /payments/verify-session (creates the order if webhook was late).
`);
  process.exit(0);
}
