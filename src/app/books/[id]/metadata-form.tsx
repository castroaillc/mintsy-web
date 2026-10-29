"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callApi } from "@/lib/client-api";
import { CATEGORIES, bookMetaSchema, isCategory, type BookMeta, type BookMetaDraft } from "@/lib/schemas";

type Errors = Partial<Record<keyof BookMeta, string>>;

export function MetadataForm({ bookId, initial }: { bookId: string; initial: BookMetaDraft }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  // A stored category outside CATEGORIES is shown as invalid and must be replaced before saving.
  const storedInvalid = initial.category !== "" && !isCategory(initial.category);
  const categoryInvalid = !isCategory(v.category);

  const set = <K extends keyof BookMetaDraft>(k: K, val: BookMetaDraft[K]) => setV((s) => ({ ...s, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bookMetaSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path[0] as keyof BookMeta] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await callApi(`/api/books/${bookId}`, { method: "PATCH", body: parsed.data });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Metadata saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field id="title" label="Title" error={errors.title}>
        <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
      </Field>
      <Field id="author" label="Author" error={errors.author}>
        <Input id="author" value={v.author} onChange={(e) => set("author", e.target.value)} aria-invalid={!!errors.author} />
      </Field>
      <Field
        id="category"
        label="Category"
        error={
          errors.category ??
          (storedInvalid && categoryInvalid
            ? `Saved as "${initial.category}", which the app doesn't know. Pick a category before saving.`
            : null)
        }
        hint="One of the app's category chips."
      >
        <Select value={isCategory(v.category) ? v.category : ""} onValueChange={(c) => set("category", c)}>
          <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category || (storedInvalid && categoryInvalid)}>
            <SelectValue placeholder={storedInvalid ? `Invalid: ${initial.category}` : "Pick a category"} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        id="order"
        label="Order"
        error={errors.order}
        hint={'Catalog position (0 first). The app features the lowest-order book on Home and shows the highest-order books as "Recently added".'}
      >
        <Input
          id="order"
          type="number"
          min={0}
          step={1}
          value={Number.isNaN(v.order) ? "" : v.order}
          onChange={(e) => set("order", e.target.valueAsNumber)}
          aria-invalid={!!errors.order}
        />
      </Field>
      <Field id="description" label="Description" error={errors.description} className="sm:col-span-2">
        <Textarea id="description" rows={4} value={v.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <ColorField id="tint" label="Tint" hint="Panel colour behind the cover." value={v.tint} error={errors.tint} onChange={(c) => set("tint", c)} />
      <ColorField id="coverTone" label="Cover tone" hint="Cover background." value={v.coverTone} error={errors.coverTone} onChange={(c) => set("coverTone", c)} />

      <div className="flex items-center gap-4 sm:col-span-2">
        <div
          className="flex h-16 w-28 items-center justify-center rounded-lg ring-1 ring-foreground/10"
          style={{ background: validHex(v.tint) ? v.tint : undefined }}
          aria-label="Preview"
        >
          <div
            className="flex h-12 w-9 items-end rounded-sm p-1 text-[6px] leading-tight font-bold text-black/70 shadow"
            style={{ background: validHex(v.coverTone) ? v.coverTone : undefined }}
          >
            {v.title.slice(0, 24)}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => (setV(initial), setErrors({}))}>
              Reset
            </Button>
          )}
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save metadata
          </Button>
        </div>
      </div>
    </form>
  );
}

function validHex(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

function ColorField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={validHex(value) ? value.toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" aria-invalid={!!error} />
      </div>
    </Field>
  );
}
