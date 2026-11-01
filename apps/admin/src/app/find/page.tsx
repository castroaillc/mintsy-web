import type { Metadata } from "next";
import { FindBooks } from "./find-books";

export const metadata: Metadata = { title: "Find books" };

export default function FindBooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find books</h1>
        <p className="text-sm text-muted-foreground">
          Only public-domain books mintsy can legally turn into episodes: published before 1931 (US), and worldwide when
          every author and translator died in 1955 or earlier. Uploader-set &ldquo;public domain&rdquo; or Creative Commons tags
          aren&apos;t trusted on their own. Each result says why it&apos;s cleared. Gutenberg books import as PDFs made from
          their text. A screening tool, not legal advice: check the title page of anything you publish.
        </p>
      </div>
      <FindBooks />
    </div>
  );
}
