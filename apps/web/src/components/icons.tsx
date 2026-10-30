import type { SVGProps } from "react";

/** Icons from the Desktop boards (24×24, 2px round strokes unless filled). */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Stroke({ size = 20, d, ...rest }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

function Fill({ size = 16, d, ...rest }: IconProps & { d: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d={d} />
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => <Stroke d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />;
export const SearchIcon = (p: IconProps) => <Stroke d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" {...p} />;
export const BookmarkIcon = (p: IconProps) => <Stroke d="M6 3h12v18l-6-4-6 4z" {...p} />;
export const BookmarkFilledIcon = ({ size = 18, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
);
export const ProfileIcon = (p: IconProps) => <Stroke d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" {...p} />;
export const PlayIcon = (p: IconProps) => <Fill d="M7 4v16l13-8z" {...p} />;
export const PauseIcon = (p: IconProps) => <Fill d="M7 4h4v16H7zM13 4h4v16h-4z" {...p} />;
export const PlusIcon = (p: IconProps) => <Stroke d="M12 5v14M5 12h14" {...p} />;
export const CheckIcon = (p: IconProps) => <Stroke d="M5 12l5 5L20 7" {...p} />;
export const BackIcon = (p: IconProps) => <Stroke d="M15 5l-7 7 7 7" {...p} />;
export const TranscriptIcon = (p: IconProps) => <Stroke d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" {...p} />;
export const ShareIcon = (p: IconProps) => <Stroke d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" {...p} />;
export const LockIcon = (p: IconProps) => <Stroke d="M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3" {...p} />;
export const Back10Icon = (p: IconProps) => <Stroke d="M11 6L4 12l7 6zM20 6l-7 6 7 6" {...p} />;
export const Forward10Icon = (p: IconProps) => <Stroke d="M13 6l7 6-7 6zM4 6l7 6-7 6" {...p} />;
export const CaptionsIcon = (p: IconProps) => <Stroke d="M3 6h18v12H3zM10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" {...p} />;
export const FullscreenIcon = (p: IconProps) => <Stroke d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...p} />;
export const NextIcon = (p: IconProps) => <Stroke d="M5 5l10 7-10 7zM19 5v14" {...p} />;
export const StarIcon = (p: IconProps) => <Fill d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.5l-5.6 2.9 1.1-6.3L3 9.7l6.2-.9z" {...p} />;
export const WarnIcon = (p: IconProps) => <Stroke d="M12 4l9 16H3zM12 10v4M12 17h.01" {...p} />;
export const MailIcon = (p: IconProps) => <Stroke d="M3 6h18v12H3zM3 7l9 6 9-6" {...p} />;
export const OfflineIcon = (p: IconProps) => (
  <Stroke d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.5-1.8M12 20h.01" {...p} />
);
export const DownloadIcon = (p: IconProps) => <Stroke d="M12 4v11M7 10l5 5 5-5M5 20h14" {...p} />;
export const GearIcon = (p: IconProps) => (
  <Stroke d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v0l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4z" {...p} />
);
export const CloseIcon = (p: IconProps) => <Stroke d="M6 6l12 12M18 6L6 18" {...p} />;

export function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.28-.88-2.3-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  );
}

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
