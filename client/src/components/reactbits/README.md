# React Bits components

Vendored from [react-bits](https://github.com/DavidHDev/react-bits) (`src/ts-default`),
the TypeScript + plain-CSS variant — this project has no Tailwind.

The `.tsx` and `.css` files here are **upstream source**, kept as close to
unmodified as possible so they stay easy to diff against a newer version.
Everything that adapts them to UniFind's soft-skeuomorphic look lives in
`client/src/index.css` under sections 28 and 30, so no local change is ever lost
to an upgrade.

## Deviations from upstream

Four, each small enough to reapply by hand after an upgrade:

- **`AnimatedList.tsx`** exports its `AnimatedItem` wrapper (upstream keeps it
  private). Upstream `AnimatedList` only accepts `string[]`, and the
  notifications feed needs real rows — a title, a body, a timestamp and a read
  state. Exporting the wrapper reuses the animation without forking the
  component.

- **`BlurText.tsx`** takes an `as` prop (`p` by default). Upstream always
  renders a `<p>`, which cannot go inside the hero's `<h1>`. The prop lets the
  page keep one semantic heading instead of splitting it across two elements or
  dropping the `<h1>` entirely.

- **`PillNav.tsx`** renders a plain `<a>` when a pill's `href` contains `#` or
  starts with `http`. Upstream routes every pill through a React Router
  `<Link>`, which updates the URL but never scrolls to an in-page anchor — the
  public header's "How it works" and "Privacy" links are exactly that.

- **`AnimatedContent.tsx`** kills only its own ScrollTrigger on unmount.
  Upstream tears down with `ScrollTrigger.getAll().forEach(t => t.kill())`,
  which destroys every trigger on the page. Because this component wraps each
  route it unmounts on every navigation, and the global version took
  `FadeContent`, `ScrollReveal` and `Masonry` down with it.

Two Tailwind class names (`flex flex-wrap` on `BlurText`) were dropped rather
than shipped as dead markup, since there is no Tailwind here to give them
meaning.

## Where each one is used

| Component | Screen |
| --- | --- |
| `AnimatedContent` | Page entrance, both authenticated layouts |
| `AnimatedList` | Notifications feed |
| `BlurText` | Home hero headline |
| `Carousel` | Home, the four steps below 900px |
| `ChromaGrid` | Home, browse-by-category |
| `ClickSpark` | Report confirmation |
| `CountUp` | Stat cards, hero counters |
| `DotGrid` | Home hero base texture |
| `DriftWall` | Home hero wall |
| `FadeContent` | Browse results, Home sections |
| `FlowingMenu` | Browse category picker |
| `GlareHover` | Home primary call to action |
| `GradientText` | Home hero eyebrow |
| `LogoLoop` | Footer, the REPORT → MATCH → CONNECT → REUNITE flow |
| `Magnet` | Primary calls to action |
| `Masonry` | Resolved gallery |
| `PillNav` | Public header |
| `ScrollReveal` | Home section headings |
| `ShinyText` | Home hero accent |
| `SpotlightCard` | Item cards, match cards |
| `Stack` | Home, "what comes back" |
| `TiltedCard` | Leading Smart Match |

## Peer dependencies

- `motion` — AnimatedList, BlurText, Carousel, CountUp, ShinyText, Stack, TiltedCard
- `gsap` — AnimatedContent, ChromaGrid, DotGrid, FadeContent, FlowingMenu, Masonry, PillNav, ScrollReveal

`DotGrid` additionally uses GSAP's `InertiaPlugin`, which has been part of the
public `gsap` package since 3.13 — no Club GreenSock licence is needed.

SpotlightCard, ClickSpark, DriftWall, GlareHover, GradientText and
LogoLoop need neither.
