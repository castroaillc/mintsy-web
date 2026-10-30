import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBookRows } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const rows = await listBookRows();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Books</h1>
          <p className="text-sm text-muted-foreground">
            The catalog in MongoDB <code className="font-mono text-xs">books</code>. Each book is a show; each chapter an episode.
          </p>
        </div>
        <Button asChild>
          <Link href="/books/new">
            <Plus /> New book
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-4">Order</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Episodes</TableHead>
              <TableHead className="pr-4 text-right">Last updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No books yet. Upload a PDF with <span className="text-foreground">New book</span>.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className="relative">
                <TableCell className="pl-4 tabular-nums text-muted-foreground">{r.order ?? "—"}</TableCell>
                <TableCell>
                  <Link href={`/books/${r.id}`} className="font-medium after:absolute after:inset-0 hover:text-brand">
                    {r.title}
                  </Link>
                  <div className="font-mono text-xs text-faint">{r.id}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.author || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span title={`${r.published} published, ${r.live} live in the app (contiguous from 1), ${r.total} total`}>
                    {r.published}
                    <span className="text-faint"> / {r.total}</span>
                  </span>
                </TableCell>
                <TableCell className="pr-4 text-right text-sm text-muted-foreground">
                  <Time iso={r.updatedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
