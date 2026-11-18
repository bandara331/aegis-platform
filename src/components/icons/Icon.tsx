import type { ReactNode } from "react";

export type IconName =
  | "home" | "list" | "chat" | "pin" | "box" | "people" | "shield" | "heart"
  | "bell" | "doc" | "user" | "pulse" | "plus" | "spark" | "sparkle"
  | "check" | "search" | "arrow" | "send" | "logout";

const ICONS: Record<IconName, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10H3z" />,
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  pin: (<><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  box: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
  people: (<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M18 20a5 5 0 0 0-3-4.5" /></>),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  bell: <path d="M6 17v-6a6 6 0 1 1 12 0v6l2 2H4zM10 21h4" />,
  doc: <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />,
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  send: <path d="M4 12h16m-5-5 5 5-5 5" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill="#0C1230" />
      <path d="M14 5 21 8v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V8z" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="14" cy="12.5" r="2.3" fill="#FF5A4F" />
    </svg>
  );
}
