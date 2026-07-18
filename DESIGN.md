# Design

## Color

**Strategy**: Restrained — brand accent on primary + tinted neutrals. Single hue family throughout.

**Brand seed**: `oklch(0.550 0.091 210)` — steel-blue, hue 210°  
**Scene**: Rare-books reading room at dusk — precise architectural lamp casting light on the manuscript, blue-shadowed shelves behind.

**Light mode**

| Role | Token | OKLCH |
|---|---|---|
| Background | `--background` | `oklch(1 0 0)` — pure white |
| Surface / Card | `--card` | `oklch(1 0 0)` |
| Subtle surface | `--muted` | `oklch(0.963 0.008 210)` |
| Sidebar | `--sidebar-background` | `oklch(0.982 0.006 210)` |
| Body text | `--foreground` | `oklch(0.165 0.012 210)` — blue-tinted ink |
| Muted text | `--muted-foreground` | `oklch(0.45 0.010 210)` — 6.2:1 on white ✓ |
| Border | `--border` | `oklch(0.905 0.010 210)` |
| Primary (button bg, key accent) | `--primary` | `oklch(0.42 0.15 210)` — steel-blue |
| Primary foreground | `--primary-foreground` | `oklch(0.98 0 0)` — white; 8:1 ✓ |
| Destructive | `--destructive` | `oklch(0.577 0.245 27.325)` — red |

**Dark mode** (`.dark` class on `<html>` OR OS `prefers-color-scheme: dark`)

| Role | Token | OKLCH |
|---|---|---|
| Background | `--background` | `oklch(0.145 0.015 210)` — blue-shadowed near-black |
| Surface | `--card` | `oklch(0.170 0.015 210)` |
| Subtle surface | `--muted` | `oklch(0.255 0.012 210)` |
| Sidebar | `--sidebar-background` | `oklch(0.160 0.015 210)` |
| Body text | `--foreground` | `oklch(0.970 0 0)` |
| Muted text | `--muted-foreground` | `oklch(0.650 0.010 210)` — 6.5:1 on dark bg ✓ |
| Border | `--border` | `oklch(0.280 0.015 210)` |
| Primary (button bg) | `--primary` | `oklch(0.62 0.15 210)` — lighter for legibility |
| Primary foreground | `--primary-foreground` | `oklch(0.12 0.015 210)` — dark ink; 5.3:1 ✓ |

**Semantic divergences**: "Coming soon" badges use `bg-amber-500` (not primary) to distinguish informational status from actionable CTAs.

## Typography

**Font stack**: Inter (Google Fonts, `latin` subset) via `next/font/google`

| Use | Class / Rule |
|---|---|
| Base body | `font-sans antialiased` (Inter) |
| Editor / code | `font-mono` (system mono stack) |
| No display or heading typeface defined | — single-family system |

**Scale**: Tailwind default — `text-xs` through `text-2xl`/`text-3xl` in use; no custom scale defined.

**Notable**: The markdown editor renders monospaced (`font-mono text-sm leading-relaxed`) for the writing surface. This is a deliberate choice — writers in the editor are looking at their raw manuscript, not a rendered view.

## Spacing & Layout

**Radius**: `--radius: 0.625rem` (~10px). Components use `rounded-md` (0.375rem), `rounded-lg` (0.625rem), `rounded-xl` (0.875rem), `rounded-2xl` (1.125rem).

**Grid**: Three-panel allotment layout in the app — explorer / editor / chat. Resizable via `allotment`. Min pane widths enforced.

**Max content width**: `max-w-[720px]` on the editor writing surface; `max-w-3xl` on the projects dashboard; `max-w-6xl` on landing sections; `max-w-4xl` on pricing.

## Components

Built on **Shadcn/UI** — `Button`, `Input`, `Label`, `Dialog`, `Popover`, `Tooltip`, `Badge` from `@/components/ui/`. All components inherit the CSS variable system.

**Notable patterns**:
- **AI toolbar**: fixed-position floating bar on text selection, `bg-background/95 backdrop-blur-sm`
- **Editor tabs**: inline file tabs with modified indicator dot
- **Entity tree**: recursive `TreeNode` with inline rename, drag/drop sorting
- **Chat messages**: user / assistant message bubbles, `outOfCredits` amber CTA variant
- **Billing card**: polling balance display with `<Suspense>` boundary

## Motion

No intentional motion system exists. Tailwind `transition-colors` appears on interactive elements (buttons, links, tree nodes). No entrance animations, scroll reveals, or skeleton loaders.

## Dark Mode

Dark mode activates via `.dark` class on `<html>` (explicit toggle) OR via `@media (prefers-color-scheme: dark)` matching `:root:not(.light)` (OS preference fallback). Add class `.light` to `<html>` to lock light mode regardless of OS. CSS variables redefine all semantic tokens under both selectors in `globals.css`.

No theme toggle component exists yet in the app UI — OS preference is the only mechanism currently active.

## Known Gaps (priority order)

1. **No motion system** — "Alive" personality requires purposeful motion. Currently zero entrance or interaction animation.
2. **No theme toggle** — Dark mode works via OS preference; no in-app toggle to override it.
3. **Single typeface** — Inter everywhere. A display or heading typeface would strengthen brand at landing-page scale.
4. **No empty states** — Several surfaces (no entities, no chat history, new projects) have minimal or placeholder empty states.
5. **Landing page motion** — Brand identity is present via the steel-blue primary; expressiveness of the page could go further with motion and stronger feature visuals.
