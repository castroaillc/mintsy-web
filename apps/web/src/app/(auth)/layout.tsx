import Link from "next/link";
import { Cover } from "@/components/cover";
import { ToastOutlet } from "@/components/toast";
import { Logo } from "@/components/ui";

/** Brand panel art from the auth boards (static, like the boards). */
const FAN = [
  { title: "The Intelligent Investor", author: "Benjamin Graham", coverTone: "#1E3557", width: 150, rotate: -6, ml: 0, t: 16, a: 10 },
  { title: "The Psychology of Money", author: "Morgan Housel", coverTone: "#E7DFCF", width: 180, rotate: 0, ml: -40, t: 19, a: 12 },
  { title: "Atomic Habits", author: "James Clear", coverTone: "#D3CFF0", width: 150, rotate: 6, ml: -40, t: 16, a: 10 },
];

/** Two-column auth layout (DeskWelcome, DeskSignUp, DeskSignIn, DeskForgot, DeskCheckEmail, DeskResetPassword). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dk-auth">
      <div className="dk-auth-side">
        <Link href="/welcome" aria-label="mintsy" className="self-start">
          <Logo size={30} />
        </Link>
        <div className="flex items-center justify-center py-5" aria-hidden="true">
          {FAN.map((c) => (
            <div key={c.title} style={{ width: c.width, transform: `rotate(${c.rotate}deg)`, marginLeft: c.ml }}>
              <Cover book={c} titleSize={c.t} authorSize={c.a} padding={12} />
            </div>
          ))}
        </div>
        <div className="flex max-w-[480px] flex-col gap-3">
          <div className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
            Every great book, one 5-minute episode at a time.
          </div>
          <div className="text-[16px] leading-[1.55] text-ink-3">
            Watch books as short video series, chapter by chapter, with a transcript for every episode.
          </div>
        </div>
      </div>
      <main className="box-border flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">{children}</div>
      </main>
      <ToastOutlet />
    </div>
  );
}
