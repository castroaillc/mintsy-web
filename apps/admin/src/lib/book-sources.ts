import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * Finds books mintsy can legally turn into episodes, and says why for each one.
 *
 * mintsy is a paid app sold worldwide that makes derivative works (scripts, narration,
 * videos), so a book is only offered when it is public domain: in the US (published before
 * 1931, as of 2026) and, for "worldwide", also in life+70 countries (EU, UK…): every
 * author/translator/editor died in 1955 or earlier.
 * Licence tags (CC0, "Public Domain Mark", CC BY…) are NOT trusted on their own: on the Internet
 * Archive anyone can set them, and copyrighted books (e.g. Think and Grow Rich, 1937) carry them.
 *
 * Sources:
 * - Project Gutenberg (OPDS search + each book's RDF record for the rights statement and
 *   contributors' death years). Gutenberg has no PDFs; its plain text is converted to a PDF
 *   (header/licence stripped, as Gutenberg's terms ask for commercial reuse) on import.
 * - Internet Archive: PDFs/EPUBs published before 1931 only, lending-library items excluded.
 *   Dates are catalogue metadata, so those results say "verify the title page".
 *
 * This is a screening tool, not legal advice; check anything you're unsure about.
 *
 * Every server-side fetch goes through `fetchFromSource`, which only follows URLs on these hosts.
 */

export type SourceId = "gutenberg" | "archive";

export type BookFile = {
  format: "pdf" | "epub";
  url: string;
  /** Bytes, when the source reports it. */
  size?: number;
  filename: string;
  /** Made from the source's plain text on download/import (Gutenberg has no PDFs). */
  converted?: boolean;
};

export type Rights = {
  /** worldwide: PD everywhere life+70 or shorter applies; us: PD in the US only. */
  scope: "worldwide" | "us";
  /** public-domain needs nothing; attribution (CC BY) needs a credit line. */
  basis: "public-domain" | "attribution";
  /** One line for the badge's tooltip. */
  summary: string;
  /** Reasons and caveats, shown under the result. */
  notes: string[];
};

export type BookResult = {
  source: SourceId;
  id: string;
  title: string;
  authors: string[];
  year?: number;
  language?: string;
  coverUrl?: string;
  pageUrl: string;
  rights: Rights;
  files: BookFile[];
};

/** US: published before this year is public domain (Jan 1 2026: works from 1930 entered PD). */
export const US_PD_BEFORE = new Date().getFullYear() - 95;
/** Life+70: authors who died in or before this year are PD in the EU/UK. */
export const WORLD_DIED_BY = new Date().getFullYear() - 71;

const UA = "mintsy-admin/0.1 (local content dashboard)";
const TIMEOUT_MS = 15_000;

const ALLOWED_HOSTS = [/^(www\.)?gutenberg\.org$/, /^archive\.org$/, /^[a-z0-9-]+(\.[a-z0-9-]+)*\.archive\.org$/];

function allowedHost(u: URL) {
  return ALLOWED_HOSTS.some((re) => re.test(u.hostname));
}

export function isAllowedSourceUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && allowedHost(u);
  } catch {
    return false;
  }
}

/** Fetches a URL on an allowed host, following up to 5 redirects that stay on allowed hosts (http upgraded to https). */
export async function fetchFromSource(raw: string, init: { timeoutMs?: number } = {}) {
  let url = raw;
  for (let hop = 0; hop < 6; hop++) {
    if (!isAllowedSourceUrl(url)) throw new Error(`Refusing to fetch ${new URL(url).hostname}: not a known book source`);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect without location from ${url}`);
      const next = new URL(loc, url);
      if (next.protocol === "http:" && allowedHost(next)) next.protocol = "https:";
      url = next.toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetchFromSource(url);
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

function safeName(s: string) {
  return s.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

/** Runs `fn` over items with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          out[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return out;
}

type Person = { name: string; role: string; died?: number };

/** Applies the life+70 test to everyone credited; unknown death years keep a book US-only. */
function worldwideTest(people: Person[]): { worldwide: boolean; notes: string[] } {
  const notes: string[] = [];
  if (people.length === 0) return { worldwide: false, notes: ["No author or translator dates on record, so only US status is known."] };
  let worldwide = true;
  for (const p of people) {
    if (p.died === undefined) {
      worldwide = false;
      notes.push(`${p.name} (${p.role}): death year unknown, so outside the US it can't be confirmed public domain.`);
    } else if (p.died > WORLD_DIED_BY) {
      worldwide = false;
      notes.push(`${p.name} (${p.role}) died ${p.died}: still protected in life+70 countries (EU, UK) until ${p.died + 71}.`);
    }
  }
  return { worldwide, notes };
}

// ---------- Project Gutenberg ----------

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

type GutenbergRecord = { rights: string; language?: string; people: Person[] };
const rdfCache = new Map<string, GutenbergRecord>();

const ROLES: Record<string, string> = { creator: "author", trl: "translator", edt: "editor", ill: "illustrator", com: "compiler" };

/** Rights statement, language and contributors (with death years) from a book's RDF record. */
async function gutenbergRecord(id: string): Promise<GutenbergRecord> {
  const cached = rdfCache.get(id);
  if (cached) return cached;
  const res = await fetchFromSource(`https://www.gutenberg.org/ebooks/${id}.rdf`);
  if (!res.ok) throw new Error(`gutenberg.org RDF ${id}: HTTP ${res.status}`);
  const xml = await res.text();
  const people: Person[] = [];
  // <dcterms:creator> / <marcrel:trl> … wrap a <pgterms:agent> with name and dates
  for (const m of xml.matchAll(/<(dcterms:creator|marcrel:(\w+))>\s*<pgterms:agent[\s\S]*?<\/pgterms:agent>/g)) {
    const block = m[0];
    const role = ROLES[m[2] ?? "creator"];
    if (!role || role === "illustrator") continue; // illustrations aren't used
    const name = decodeXml(block.match(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/)?.[1] ?? "Unknown");
    const died = block.match(/<pgterms:deathdate[^>]*>(-?\d+)<\/pgterms:deathdate>/)?.[1];
    people.push({ name, role, died: died ? Number(died) : undefined });
  }
  const record = {
    rights: decodeXml(xml.match(/<dcterms:rights>([\s\S]*?)<\/dcterms:rights>/)?.[1] ?? ""),
    language: xml.match(/<dcterms:language>[\s\S]*?<rdf:value[^>]*>(\w+)<\/rdf:value>/)?.[1],
    people,
  };
  rdfCache.set(id, record);
  return record;
}

async function searchGutenberg(q: string): Promise<BookResult[]> {
  const res = await fetchFromSource(`https://www.gutenberg.org/ebooks/search.opds/?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`gutenberg.org returned HTTP ${res.status}`);
  const xml = await res.text();
  const entries: { id: string; title: string; author: string }[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = entry.match(/<id>https?:\/\/www\.gutenberg\.org\/ebooks\/(\d+)\.opds<\/id>/)?.[1];
    if (!id) continue; // navigation entries (sort links etc.)
    entries.push({
      id,
      title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? `Gutenberg #${id}`),
      author: decodeXml(entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? ""),
    });
  }

  const settled = await mapLimit(entries.slice(0, 20), 6, async (e): Promise<BookResult | null> => {
    const rec = await gutenbergRecord(e.id);
    // A few Gutenberg books are still copyrighted (published with permission): never offer them
    if (!/^public domain in the usa/i.test(rec.rights)) return null;
    const { worldwide, notes } = worldwideTest(rec.people);
    const credits = rec.people.map((p) => `${p.name} (${p.role}${p.died !== undefined ? `, d. ${p.died}` : ""})`).join("; ");
    return {
      source: "gutenberg",
      id: e.id,
      title: e.title,
      authors: rec.people.filter((p) => p.role === "author").map((p) => p.name),
      language: rec.language,
      coverUrl: `https://www.gutenberg.org/cache/epub/${e.id}/pg${e.id}.cover.medium.jpg`,
      pageUrl: `https://www.gutenberg.org/ebooks/${e.id}`,
      rights: {
        scope: worldwide ? "worldwide" : "us",
        basis: "public-domain",
        summary: worldwide ? "Public domain worldwide (US + life+70)" : "Public domain in the US only",
        notes: [
          `Gutenberg: "${rec.rights.replace(/\.$/, "")}".${credits ? ` Credits: ${credits}.` : ""}`,
          ...notes,
          "Gutenberg's own header and licence are stripped from the PDF; don't use the Project Gutenberg name in the app.",
        ],
      },
      files: [
        { format: "pdf", url: `https://www.gutenberg.org/ebooks/${e.id}.txt.utf-8`, filename: `pg${e.id}.pdf`, converted: true },
        { format: "epub", url: `https://www.gutenberg.org/ebooks/${e.id}.epub3.images`, filename: `pg${e.id}.epub` },
      ],
    };
  });
  return settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

// ---------- Internet Archive ----------

type IaDoc = { identifier: string; title?: string; creator?: string | string[]; year?: number | string; language?: string | string[] };
type IaFile = { name: string; format?: string; size?: string };
type IaMetadata = { files?: IaFile[] };

const IA_PDF_FORMATS = new Set(["Text PDF", "Image Container PDF", "Additional Text PDF"]);

function arr<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** IA creators are often "Smith, Adam, 1723-1790"; take the death year when it's there. */
function personFromCreator(creator: string): Person {
  const dates = creator.match(/(\d{3,4})\s*-\s*(\d{3,4})\s*\.?$/);
  const name = creator.replace(/,?\s*\(?\d{3,4}\s*-\s*\d{0,4}\)?\.?$/, "").trim();
  return { name, role: "author", died: dates ? Number(dates[2]) : undefined };
}

async function searchArchive(q: string): Promise<BookResult[]> {
  const terms = q.replace(/[^\p{L}\p{N}\s'-]+/gu, " ").trim() || "*";
  const query =
    `(title:(${terms}) OR creator:(${terms})) AND mediatype:texts AND (format:PDF OR format:EPUB) ` +
    `AND NOT access-restricted-item:true AND NOT collection:inlibrary AND NOT collection:printdisabled ` +
    `AND year:[* TO ${US_PD_BEFORE - 1}]`;
  const params = new URLSearchParams({ q: query, rows: "20", output: "json" });
  for (const f of ["identifier", "title", "creator", "year", "language"]) params.append("fl[]", f);
  const data = await getJson<{ response?: { docs: IaDoc[] }; error?: string }>(`https://archive.org/advancedsearch.php?${params}`);
  if (!data.response) throw new Error(`Internet Archive search failed: ${data.error ?? "no response"}`);

  const settled = await mapLimit(data.response.docs, 6, async (d): Promise<BookResult | null> => {
    const meta = await getJson<IaMetadata>(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`);
    const yearNum = Number(d.year);
    const year = Number.isFinite(yearNum) && yearNum > 0 ? yearNum : undefined;
    // Only the publication date clears an IA item; uploader licence tags aren't evidence
    if (year === undefined || year >= US_PD_BEFORE) return null;

    const people = arr(d.creator).map(personFromCreator);
    const { worldwide, notes } = worldwideTest(people);
    const rights: Rights = {
      scope: worldwide ? "worldwide" : "us",
      basis: "public-domain",
      summary: worldwide ? `Published ${year}; public domain worldwide` : `Published ${year}; public domain in the US only`,
      notes: [
        `US public domain: published ${year}, before ${US_PD_BEFORE}.`,
        ...notes,
        "Dates are Internet Archive catalogue data: check the title page, and that this edition (not a later translation or annotated reprint) is old enough. A translator counts as an author.",
      ],
    };

    const files: BookFile[] = [];
    for (const f of meta.files ?? []) {
      const format = f.format && IA_PDF_FORMATS.has(f.format) ? "pdf" : f.format === "EPUB" ? "epub" : null;
      if (!format) continue;
      files.push({
        format,
        url: `https://archive.org/download/${encodeURIComponent(d.identifier)}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
        size: f.size ? Number(f.size) : undefined,
        filename: safeName(f.name.split("/").pop() ?? f.name),
      });
    }
    if (files.length === 0) return null;
    return {
      source: "archive",
      id: d.identifier,
      title: d.title ?? d.identifier,
      authors: people.map((p) => p.name),
      year,
      language: arr(d.language)[0],
      coverUrl: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      pageUrl: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
      rights,
      files,
    };
  });
  return settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

export async function searchBooks(q: string, sources: SourceId[]) {
  const runs = await Promise.allSettled(sources.map((s) => (s === "gutenberg" ? searchGutenberg(q) : searchArchive(q))));
  const results: BookResult[] = [];
  const errors: { source: SourceId; error: string }[] = [];
  runs.forEach((r, i) => {
    if (r.status === "fulfilled") results.push(...r.value);
    else errors.push({ source: sources[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  // Worldwide-cleared first, then US-only
  results.sort((a, b) => Number(b.rights.scope === "worldwide") - Number(a.rights.scope === "worldwide"));
  return { results, errors };
}

// ---------- Gutenberg text → PDF ----------

const run = promisify(execFile);

export function isGutenbergText(url: string) {
  return /^https:\/\/(www\.)?gutenberg\.org\/ebooks\/\d+\.txt\.utf-8$/.test(url);
}

/**
 * Downloads a Gutenberg plain-text book, strips Gutenberg's header and licence (their terms
 * for commercial reuse of the public-domain text), and lays it out as a PDF with macOS's
 * cupsfilter, so it goes through the same ingest as any other PDF.
 */
export async function gutenbergTextToPdf(url: string): Promise<Buffer> {
  const res = await fetchFromSource(url, { timeoutMs: 60_000 });
  if (!res.ok) throw new Error(`gutenberg.org returned HTTP ${res.status}`);
  const text = await res.text();
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (start < 0 || end < 0 || end <= start) throw new Error("Couldn't find the start/end of the book text in Gutenberg's file");
  const body = text.slice(text.indexOf("\n", start) + 1, end).trim();

  const dir = await mkdtemp(path.join(os.tmpdir(), "mintsy-gutenberg-"));
  try {
    const txt = path.join(dir, "book.txt");
    await writeFile(txt, body, "utf8");
    const { stdout } = await run("/usr/sbin/cupsfilter", ["-m", "application/pdf", "-o", "cpi=12", "-o", "lpi=7", txt], {
      encoding: "buffer",
      maxBuffer: 100 * 1024 * 1024,
    });
    return stdout as Buffer;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error("PDF conversion needs macOS's cupsfilter (/usr/sbin/cupsfilter)");
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
