import { DOWNLOAD_FILES, products, json, signPath, stripe, stripeKeyProblem } from "../../lib/shop.js";

// After checkout, the thank-you page asks here for the order and fresh download links.
// Links are only given for a paid Stripe Checkout session, and each link works for 7 days.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Order not found." }, 404);
  if (stripeKeyProblem(env)) return json({ error: "Downloads are not set up yet." }, 500);

  let session;
  try {
    session = await stripe(env, "GET", `checkout/sessions/${id}`);
  } catch (err) {
    return json({ error: "Order not found." }, 404);
  }
  if (session.payment_status !== "paid") return json({ error: "This order has not been paid yet." }, 402);

  const item = products(env)[session.metadata?.product] || null;
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const downloads = await Promise.all(
    DOWNLOAD_FILES.map(async (f) => ({ name: f.name, url: await signPath(env, f.path, expires) }))
  );

  return json(
    {
      item: item ? item.name : "Your order",
      size: session.metadata?.size || "",
      shipped: !!item?.shipped,
      email: session.customer_details?.email || "",
      downloads,
    },
    200,
    { "cache-control": "no-store" }
  );
}
