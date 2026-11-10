# SupportFamilyMusic.com

The "You're My Son" song site, rebuilt from the old WordPress (Voxel + Elementor) backup as a plain static site
on Cloudflare Pages, the same way SeekandKnock.com runs.

- `public/` — the pages, images, and the paid download files (`public/downloads/`).
- `functions/api/checkout.js` — starts Stripe Checkout for the song ($0.99), Bronze Supporter ($4.99), dad hat ($19) or tee ($14).
- `functions/api/order.js` — the thank-you page gets signed download links here (only for paid orders; links last 7 days).
- `functions/api/patrons.js` — the Patrons page lists Bronze Supporter names straight from paid Stripe orders.
- `functions/downloads/_middleware.js` — files in `/downloads` are only served with a valid signed link.
- `wrangler.toml` — prices and shipping. Changing a price here changes both the page and checkout.

## Cloudflare setup (once)

1. Workers & Pages → Create → Pages → Connect to Git → pick `supportfamilymusic`.
2. Build command: leave empty. Build output directory: `public`. Save and Deploy.
   (New dashboard: Create application → "Looking to deploy Pages? Get started" → Import an existing Git repository.)
3. Settings → Variables and Secrets → add `STRIPE_SECRET_KEY` (type Secret) with the same Stripe key SeekandKnock uses.
4. Custom domains → add `supportfamilymusic.com` and `www.supportfamilymusic.com`.

## Orders

Every order appears in Stripe → Payments. Hat and tee orders show the size and shipping address there;
place them in Printful by hand for now.
