import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Time } from "@/components/time";
import { latestScript } from "@/lib/catalog";
import { hasActiveJob } from "@/lib/jobs";
import { booksCol } from "@/lib/mongo";
import { effectiveStatus } from "@/lib/status";
import { ScriptEditor } from "./script-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/books/[id]/chapters/[n]/script">): Promise<Metadata> {
  const { id, n } = await params;
  return { title: `${id} · chapter ${n} script` };
}

export default async function ScriptPage({ params }: PageProps<"/books/[id]/chapters/[n]/script">) {
  const { id, n: nRaw } = await params;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n < 1) notFound();
  const script = await latestScript(id, n);
  if (!script) notFound();
  const book = await (await booksCol()).findOne({ _id: id }, { projection: { title: 1, episodes: 1 } });
  const ep = book?.episodes.find((e) => e.number === n);
  const laterLive = book?.episodes.some((e) => e.number > n && effectiveStatus(e.status) === "published") ?? false;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/books/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {book?.title ?? id}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Chapter {n} script</h1>
        <p className="text-sm text-muted-foreground">
          From the script job finished <Time iso={script.finishedAt.toISOString()} />. Edits are sent with the render job; the studio writes them before voicing.
        </p>
      </div>
      <ScriptEditor
        bookId={id}
        chapter={n}
        script={script.result.script}
        scenes={script.result.scenes}
        episodeStatus={ep ? effectiveStatus(ep.status) : null}
        laterLive={laterLive}
        busy={await hasActiveJob(id, n)}
      />
    </div>
  );
}
