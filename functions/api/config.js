import { products, json } from "../../lib/shop.js";

// Prices and shipping for the page to show, taken from wrangler.toml so the page always matches checkout.
export async function onRequestGet({ env }) {
  const all = products(env);
  const prices = Object.fromEntries(Object.entries(all).map(([id, p]) => [id, p.price]));
  return json({ prices, shipping: env.SHIPPING_USD || "0" }, 200, { "cache-control": "public, max-age=300" });
}
