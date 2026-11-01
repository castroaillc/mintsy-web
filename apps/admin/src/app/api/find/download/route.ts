import { jsonError } from "@/lib/api";
import { fetchFromSource, gutenbergTextToPdf, isAllowedSourceUrl, isGutenbergText } from "@/lib/book-sources";

/**
 * GET /api/find/download?url=...&filename=... streams a PDF/EPUB from a known book
 * source to the browser as an attachment (so it saves instead of opening a viewer).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const url = params.get("url") ?? "";
  if (!isAllowedSourceUrl(url)) return jsonError(400, "url: not a known book source");
  const filename = (params.get("filename") ?? "book").replace(/[^\w.-]+/g, "_").slice(0, 120) || "book";

  // Gutenberg has no PDFs: build one from the plain text
  if (isGutenbergText(url)) {
    try {
      const pdf = await gutenbergTextToPdf(url);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${filename}"`,
          "content-length": String(pdf.length),
        },
      });
    } catch (err) {
      return jsonError(502, err instanceof Error ? err.message : "Conversion failed");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetchFromSource(url, { timeoutMs: 120_000 });
  } catch (err) {
    return jsonError(502, err instanceof Error ? err.message : "Download failed");
  }
  if (!upstream.ok || !upstream.body) return jsonError(502, `Source returned HTTP ${upstream.status}`);

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "content-disposition": `attachment; filename="${filename}"`,
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  return new Response(upstream.body, { headers });
}
