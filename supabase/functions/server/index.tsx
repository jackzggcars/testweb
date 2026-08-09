import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-daae60d2/health", (c) => c.json({ status: "ok" }));

const UB_TOKEN = Deno.env.get("UNBELIEVABOAT_TOKEN") ?? "";
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const UB_BASE  = "https://unbelievaboat.com/api/v1";

async function ubGet(discordId: string) {
  const res = await fetch(`${UB_BASE}/guilds/${GUILD_ID}/users/${discordId}`, {
    headers: { Authorization: UB_TOKEN },
  });
  if (!res.ok) throw new Error(`UB ${res.status}`);
  return res.json();
}

async function ubPatch(discordId: string, cashDelta: number) {
  const res = await fetch(`${UB_BASE}/guilds/${GUILD_ID}/users/${discordId}`, {
    method: "PATCH",
    headers: { Authorization: UB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ cash: cashDelta }),
  });
  if (!res.ok) throw new Error(`UB ${res.status}: ${await res.text()}`);
  return res.json();
}

app.get("/make-server-daae60d2/ub/balance/:discordId", async (c) => {
  try {
    const data = await ubGet(c.req.param("discordId"));
    return c.json({ cash: data.cash, total: data.total });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/make-server-daae60d2/ub/deduct", async (c) => {
  try {
    const { discordId, amount } = await c.req.json();
    if (!discordId || !amount || amount <= 0) return c.json({ error: "invalid" }, 400);
    const bal = await ubGet(discordId);
    if (bal.cash < amount) return c.json({ error: "insufficient_funds" }, 400);
    const updated = await ubPatch(discordId, -Math.abs(amount));
    return c.json({ cash: updated.cash });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/make-server-daae60d2/ub/payout", async (c) => {
  try {
    const { discordId, amount } = await c.req.json();
    if (!discordId || !amount || amount <= 0) return c.json({ error: "invalid" }, 400);
    const updated = await ubPatch(discordId, Math.abs(amount));
    return c.json({ cash: updated.cash });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

Deno.serve(app.fetch);