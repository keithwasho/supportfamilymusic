import { verifyPath } from "../../lib/shop.js";

// Files under /downloads are paid content: serve them only with a valid, unexpired signed link.
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const ok = await verifyPath(env, url.pathname, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (!ok) {
    return new Response(
      "This download link has expired or is not valid. Open the link from your order confirmation page to get a fresh one.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("content-disposition", `attachment; filename="${url.pathname.split("/").pop()}"`);
  out.headers.set("cache-control", "private, no-store");
  out.headers.set("x-robots-tag", "noindex");
  return out;
}
