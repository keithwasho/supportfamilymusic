// Shared helpers for the SupportFamilyMusic.com shop.
// Payments use Stripe Checkout through Stripe's REST API (no npm packages, no build step).
// Prices live in wrangler.toml [vars]; the secret key STRIPE_SECRET_KEY is added in the Cloudflare dashboard.

export const DOWNLOAD_FILES = [
  { name: "You're My Son (MP3)", path: "/downloads/Youre-My-Son.mp3" },
  { name: "Lyric sheet (PDF)", path: "/downloads/Youre-My-Son-Lyrics.pdf" },
  { name: "Chord sheet (JPG)", path: "/downloads/Youre-My-Son-Chord-Sheet.jpg" },
];

export const TEE_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

// Every item includes the song download, lyric sheet and chord sheet.
export function products(env) {
  return {
    song: {
      name: "You're My Son (song download)",
      description: "MP3 download of \"You're My Son\" with lyric and chord sheets.",
      price: env.SONG_PRICE_USD || "0.99",
      shipped: false,
    },
    bronze: {
      name: "Bronze Supporter",
      description: "Song download, lyric and chord sheets, and your name on the Patron Supporters page.",
      price: env.BRONZE_PRICE_USD || "4.99",
      shipped: false,
      patron: true,
      tier: "Bronze",
    },
    silver: {
      name: "Silver Supporter",
      description: "Unisex \"You're My Son\" tee, song download, lyric and chord sheets, and your name on the Patron Supporters page.",
      price: env.SILVER_PRICE_USD || "14.99",
      shipped: true,
      sizes: TEE_SIZES,
      patron: true,
      tier: "Silver",
    },
    gold: {
      name: "Gold Supporter",
      description: "\"You're My Son\" dad hat, song download, lyric and chord sheets, and your name on the Patron Supporters page.",
      price: env.GOLD_PRICE_USD || "24.99",
      shipped: true,
      patron: true,
      tier: "Gold",
    },
    hat: {
      name: "You're My Son Dad Hat",
      description: "White embroidered dad hat. Includes the song download, lyric and chord sheets.",
      price: env.HAT_PRICE_USD || "19.00",
      shipped: true,
    },
    tee: {
      name: "You're My Son Unisex Tee",
      description: "Unisex jersey short sleeve tee. Includes the song download, lyric and chord sheets.",
      price: env.TEE_PRICE_USD || "14.00",
      shipped: true,
      sizes: TEE_SIZES,
    },
  };
}

export function cents(usd) {
  return Math.round(parseFloat(usd) * 100);
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function siteUrl(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export function stripeKeyProblem(env) {
  const k = env.STRIPE_SECRET_KEY || "";
  if (!k) return "STRIPE_SECRET_KEY is not set in Cloudflare.";
  if (!/^(sk|rk)_(live|test)_/.test(k)) return "STRIPE_SECRET_KEY does not look like a Stripe secret key.";
  return null;
}

// Turns a nested object into Stripe's form encoding: line_items[0][price_data][currency]=usd
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export async function stripe(env, method, path, params) {
  const init = {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  };
  let url = `${env.STRIPE_API_BASE || "https://api.stripe.com"}/v1/${path}`; // STRIPE_API_BASE is only for local testing
  if (params && method === "GET") url += `?${formEncode(params)}`;
  else if (params) {
    init.headers["content-type"] = "application/x-www-form-urlencoded";
    init.body = formEncode(params);
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error ${res.status}`);
    err.code = data?.error?.code || data?.error?.type || String(res.status);
    throw err;
  }
  return data;
}

// --- Signed download links -------------------------------------------------
// The files in /downloads are only served with a valid signature that expires.
// The signing key is derived from the Stripe secret key, so there is no extra secret to set up.

async function hmacKey(env) {
  const raw = new TextEncoder().encode(`sfm-downloads:${env.STRIPE_SECRET_KEY || ""}`);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signPath(env, path, expiresAt) {
  const key = await hmacKey(env);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${path}|${expiresAt}`));
  return `${path}?exp=${expiresAt}&sig=${toHex(sig)}`;
}

export async function verifyPath(env, path, expiresAt, sig) {
  if (!sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const exp = parseInt(expiresAt, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const key = await hmacKey(env);
  const bytes = new Uint8Array(sig.match(/../g).map((h) => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(`${path}|${exp}`));
}
