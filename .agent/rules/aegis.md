# AEGIS project rules

- Stack: Next.js 15 App Router, React 19, TypeScript strict. Frontend only; never add backend code.
- Components live in `src/components/<area>/`. Data comes only through `src/lib/api` (mock now,
  ASP.NET Web API later). Do not import `src/data/*` from components or pages directly.
- Keep server components by default. Add `"use client"` only for real interactivity.
- Styling: plain CSS scoped under `.landing` / `.dash`. New screens get their own scoped stylesheet.
- Design language: obsidian base `#07090D`; `#FF4D2E` = critical, `#FFB020` = warning,
  `#2DD4A3` = approved/safe, violet-to-cyan (`#8B5CFF` to `#22D3EE`) is reserved for AI output.
  Fonts: Bricolage Grotesque (display), Geist (UI), JetBrains Mono (data).
- Accessibility: visible focus, 44px touch targets, `prefers-reduced-motion` respected.
- Before finishing any task run `npm run typecheck` and `npm run build`, and fix errors.

