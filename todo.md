# UniFind Implementation Checklist

## Migration to the specified stack (React → FastAPI → SQLite)

- [x] Replace the Manus tRPC/Drizzle/MySQL backend with FastAPI + SQLite.
- [x] Model User, Item, Claim, ItemMatch, Comment, Conversation, Message, Notification, ContentReport.
- [x] Replace the broken managed-OAuth flow with working registration and sign-in (bcrypt + JWT session cookie).
- [x] Enforce the UIU email rule (`*.uiu.ac.bd`, any department) on both frontend and backend.
- [x] Restyle the interface to the soft industrial skeuomorphism direction.
- [x] Restructure the frontend into components / layouts / pages / services / context / hooks.
- [x] Swap wouter for React Router and build the complete route table.

## Features

- [x] **Feature 1** — Report a lost or found item, with photo upload, saved to SQLite.
- [x] **Feature 2** — Browse with search, type/category/location/status filters, and sorting.
- [x] **Feature 3** — Claims and status tracking (`OPEN → PENDING → RESOLVED`).
- [x] Rule-based Smart Matching with a scored evidence comparison.
- [x] Community comments on listings.
- [x] Private messaging tied to an item or claim.
- [x] Notifications that link to the right destination.
- [x] Resolved gallery.
- [x] User dashboard with summary modules, quick actions, and recent activity.
- [x] Admin dashboard, post moderation, report queue, and basic user administration.
- [x] Email confirmation: a six-digit code mailed to the UIU address, with a hard
      gate — nothing is reachable until the code is confirmed. Switched OFF by
      default (`UNIFIND_REQUIRE_EMAIL_CONFIRMATION`); falls back to the backend
      console when no SMTP is set.

## Quality

- [x] Loading, empty, and error states on every data-driven screen.
- [x] Responsive layouts: 3 cards desktop, 2 tablet, 1 mobile, ~48px touch targets.
- [x] Ownership and admin authorisation enforced server-side, never trusting the frontend.
- [x] API verified end-to-end — `backend/smoke_test.ps1` (65 checks with email
      confirmation off, 72 with it on).
- [x] Frontend typecheck and production build clean.
- [x] README with setup commands, demo accounts, API reference, and the faculty demo flow.

## Interface libraries

- [x] React Bits: 11 more components vendored — AnimatedContent, BlurText,
      Carousel, ChromaGrid, ClickSpark, DotGrid, FlowingMenu, GlareHover,
      GradientText, LogoLoop, PillNav — restyled against the skeuomorphic
      tokens, in `index.css` sections 28 and 30.
- [x] React Hook Form + Zod on every form: report/edit, login, register, claim.
      `client/src/lib/schemas.ts` is the single description of a valid payload.
- [x] TanStack Table behind the admin tables, with sorting, search, and paging.
- [x] Recharts on the admin overview: lost-against-found and the case mix.
- [x] Admin routes lazy-loaded, keeping Recharts and TanStack Table (~450 kB)
      off the landing page and every member screen.

## Possible next steps

- [ ] Multi-photo item galleries. The user-facing ask was a photo carousel on
      the item page, but `Item.image_url` holds exactly one photo — this needs
      an `item_images` table, a multi-upload endpoint, and a schema change
      before a gallery has anything to show.
- [ ] shadcn/ui, Aceternity, and Magic UI were left out: all three are
      Tailwind-only and this project uses a hand-written CSS system. Adopting
      them means adding Tailwind and reworking `index.css`.
- [ ] Let a member correct a mistyped email before confirming, instead of
      registering again.
- [ ] Move item photos to an external image bucket instead of `backend/uploads/`.
- [ ] Add a "Not my item" dismissal that hides a specific match pair for that member.
- [ ] Port `backend/smoke_test.ps1` to pytest so it runs cross-platform.
