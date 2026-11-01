import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { jsonError, parseEpisodeNumber } from "@/lib/api";
import { bookIdSchema } from "@/lib/schemas";
import { previewFilePath } from "@/lib/studio-work";

const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", mp3: "audio/mpeg" };

/**
 * GET /api/books/:id/chapters/:n/preview/<file> serves a render's local output from
 * studio/work (episode.mp4, thumbnail.jpg, audio clips), with Range support so video seeks.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/books/[id]/chapters/[n]/preview/[...file]">) {
  const { id, n, file } = await params;
  const book = bookIdSchema.safeParse(id);
  const chapter = parseEpisodeNumber(n);
  const filePath = book.success && chapter ? previewFilePath(book.data, chapter, file.join("/")) : null;
  if (!filePath) return jsonError(404, "Not a previewable file");

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return jsonError(404, "Not rendered yet");
  }
  const type = TYPES[filePath.split(".").pop() ?? ""] ?? "application/octet-stream";
  const headers = new Headers({ "content-type": type, "accept-ranges": "bytes", "cache-control": "no-cache" });

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers });
  }
  headers.set("content-length", String(size));
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { headers });
}
