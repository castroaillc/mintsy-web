import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing here. <Link href="/" className="text-brand hover:underline">Back to books</Link>
      </p>
    </div>
  );
}
