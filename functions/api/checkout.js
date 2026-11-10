import { products, cents, json, siteUrl, stripe, stripeKeyProblem } from "../../lib/shop.js";

const BRAND_NAME = "Support Family Music";

// Starts a Stripe Checkout for one item: song, bronze, silver, gold, hat or tee.
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const all = products(env);
  const id = String(body?.product || "");
  const item = all[id];
  if (!item) return json({ error: "That item is not available." }, 400);

  let size = "";
  if (item.sizes) {
    size = String(body?.size || "");
    if (!item.sizes.includes(size)) return json({ error: "Please choose a size." }, 400);
  }

  const problem = stripeKeyProblem(env);
  if (problem) {
    console.error(problem);
    return json({ error: "Checkout is not set up yet. Please try again soon." }, 500);
  }

  const site = siteUrl(request);
  const name = size ? `${item.name} (size ${size})` : item.name;
  const params = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents(item.price),
          product_data: { name, description: item.description },
        },
      },
    ],
    metadata: { product: id, size },
    payment_intent_data: { description: name, metadata: { product: id, size } },
    success_url: `${site}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/#support`,
    allow_promotion_codes: "true",
  };

  if (item.shipped) {
    const shipping = cents(env.SHIPPING_USD || "0");
    params.shipping_address_collection = { allowed_countries: ["US"] };
    params.phone_number_collection = { enabled: "true" };
    params.shipping_options = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: shipping === 0 ? "Free US shipping" : "US shipping",
          fixed_amount: { amount: shipping, currency: "usd" },
        },
      },
    ];
  }

  if (item.patron) {
    params.custom_fields = [
      {
        key: "patronname",
        label: { type: "custom", custom: "Name for the Patrons page" },
        type: "text",
        optional: "true",
        text: { maximum_length: 40 },
      },
    ];
  }

  // Show Support Family Music (not the Stripe account's own business name) on the checkout page.
  // If Stripe rejects the logo or the whole setting, fall back step by step so checkout always works.
  const logo = { type: "url", url: `${site}/img/checkout-logo.png` };
  const brandingTries = [
    { display_name: BRAND_NAME, logo, icon: logo },
    { display_name: BRAND_NAME },
    null,
  ];

  try {
    let session;
    for (const [i, branding] of brandingTries.entries()) {
      try {
        session = await stripe(env, "POST", "checkout/sessions", branding ? { ...params, branding_settings: branding } : params);
        break;
      } catch (err) {
        const last = i === brandingTries.length - 1;
        if (last || !(err.status === 400 || err.code === "parameter_unknown" || err.code === "parameter_invalid_empty")) throw err;
        console.warn(`Checkout branding try ${i + 1} rejected: ${err.message}`);
      }
    }
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: `Could not start checkout. Please try again. (Stripe: ${err.code || "unreachable"})` }, 500);
  }
}
