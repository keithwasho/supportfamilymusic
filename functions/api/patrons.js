import { json, stripe, stripeKeyProblem } from "../../lib/shop.js";

// Lists the names Bronze Supporters asked to show, read straight from paid Stripe orders.
// Cached for 10 minutes so Stripe is not asked on every visit.
export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/patrons?v=1", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  if (stripeKeyProblem(env)) return json({ patrons: [] });

  const names = [];
  let starting_after;
  try {
    for (let page = 0; page < 10; page++) {
      const params = { limit: 100, status: "complete" };
      if (starting_after) params.starting_after = starting_after;
      const res = await stripe(env, "GET", "checkout/sessions", params);
      for (const s of res.data) {
        if (s.metadata?.product !== "bronze" || s.payment_status !== "paid") continue;
        const field = (s.custom_fields || []).find((f) => f.key === "patronname");
        const name = (field?.text?.value || "").trim().slice(0, 40);
        if (name) names.push(name);
      }
      if (!res.has_more || !res.data.length) break;
      starting_after = res.data[res.data.length - 1].id;
    }
  } catch (err) {
    console.error(err);
    return json({ patrons: [] });
  }

  const hidden = (env.HIDDEN_PATRONS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const patrons = names.filter((n) => !hidden.includes(n.toLowerCase())).reverse(); // oldest first
  const res = json({ patrons }, 200, { "cache-control": "public, max-age=600" });
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
