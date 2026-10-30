import type { Metadata } from "next";
import { NewBookForm } from "./new-book-form";

export const metadata: Metadata = { title: "New book" };

export default function NewBookPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New book</h1>
        <p className="text-sm text-muted-foreground">
          Upload the PDF. The studio worker splits it into chapters and creates a draft book; nothing shows in the app until you publish.
        </p>
      </div>
      <NewBookForm />
    </div>
  );
}
