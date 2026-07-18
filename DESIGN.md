# Design

## Color

**Strategy**: Restrained — achromatic neutrals + one accent. Currently the palette has zero chroma; a brand accent color is the highest-priority visual improvement.

**Light mode**

| Role | Token | OKLCH |
|---|---|---|
| Background | `--background` | `oklch(1 0 0)` — pure white |
| Surface / Card | `--card` | `oklch(1 0 0)` |
| Subtle surface | `--muted` | `oklch(0.965 0 0)` |
| Sidebar | `--sidebar-background` | `oklch(0.985 0 0)` |
| Body text | `--foreground` | `oklch(0.145 0 0)` |
| Muted text | `--muted-foreground` | `oklch(0.556 0 0)` |
| Border | `--border` | `oklch(0.922 0 0)` |
| Primary (button bg, key accent) | `--primary` | `oklch(0.205 0 0)` — near-black |
| Primary foreground | `--primary-foreground` | `oklch(0.985 0 0)` |
| Destructive | `--destructive` | `oklch(0.577 0.245 27.325)` — red |

**Dark mode** (`.dark` class on `<html>`)

| Role | Token | OKLCH |
|---|---|---|
| Background | `--background` | `oklch(0.145 0 0)` |
| Surface | `--card` | `oklch(0.145 0 0)` |
| Subtle surface | `--muted` | `oklch(0.269 0 0)` |
| Sidebar | `--sidebar-background` | `oklch(0.175 0 0)` |
| Body text | `--foreground` | `oklch(0.985 0 0)` |
| Muted text | `--muted-foreground` | `oklch(0.708 0 0)` |
| Border | `--border` | `oklch(0.269 0 0)` |
| Primary (button bg) | `--primary` | `oklch(0.985 0 0)` — near-white |
| Sidebar accent (only chroma in dark) | `--sidebar-primary` | `oklch(0.488 0.243 264.376)` — blue |

**Note**: The palette is entirely achromatic (C=0) except for destructive red and the dark sidebar primary blue (which appears only on one component). No brand chroma exists yet. `/impeccable colorize` is the recommended next step to introduce a purposeful brand accent.

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

Dark mode is applied via a `.dark` class on `<html>`. Toggle mechanism exists in the top bar (`ThemeToggle` component). CSS variables redefine all semantic tokens under `.dark {}` in `globals.css`. The system is complete — every token has a dark value.

## Known Gaps (priority order)

1. **No brand chroma** — achromatic palette has no identity. Completely generic Shadcn default.
2. **No motion system** — "Alive" personality requires purposeful motion. Currently zero entrance or interaction animation.
3. **Single typeface** — Inter everywhere. A display or heading typeface would strengthen brand at landing-page scale.
4. **No empty states** — Several surfaces (no entities, no chat history, new projects) have minimal or placeholder empty states.
5. **Landing page** — Good structure, but neutral visual execution. Doesn't express "Intelligent · Alive · Collaborative" at all.
