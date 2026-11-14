# ClaimBack design system

The interface follows the quiet, gallery-like approach of Apple's marketing
site (analysis: VoltAgent/awesome-design-md, `design-md/apple`, MIT): the UI
recedes and the one thing that matters on each screen, usually a dollar
amount, takes the stage. This is a style direction, not Apple branding: no
Apple names, logos, product images or the SF Pro font files.

## Principles

- **One idea per screen section.** Each section is a full-width band with a
  lot of air. Light and dark bands alternate; the color change is the divider,
  not borders or shadows.
- **The number is the hero.** The amount we found is the largest thing on the
  results screen. Everything else is quieter.
- **One action color.** Every clickable thing is Action Blue. Nothing else is
  blue, and there is no second brand color.
- **No decoration.** No gradients, no shadows on cards, buttons or text, no
  decorative icons. Hairline borders only on utility cards.
- **Progressive disclosure.** Details (evidence, line items, letters) sit
  behind tabs or a "Show details" control, never all on one page.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `primary` | `#0066cc` | Buttons, links, active tab, focus ring base |
| `primary-focus` | `#0071e3` | 2px focus ring |
| `primary-on-dark` | `#2997ff` | Links and accents on dark bands |
| `ink` | `#1d1d1f` | All text on light surfaces |
| `ink-muted` | `#6e6e73` | Secondary text, captions |
| `canvas` | `#ffffff` | Default page and cards |
| `parchment` | `#f5f5f7` | Alternating light band, footer, inputs |
| `tile-dark` | `#1d1d1f` | Dark band (summary, final call to action) |
| `on-dark` | `#ffffff` | Text on dark bands |
| `on-dark-muted` | `#a1a1a6` | Secondary text on dark bands |
| `hairline` | `#e0e0e0` | 1px border on utility cards and inputs |
| `flag` | `#b25000` | Semantic only: flagged bill lines, "worth checking" |
| `flag-soft` | `#fff4e5` | Background of a flagged line |
| `ok` | `#1d7a46` | Semantic only: "high confidence", done steps |

`flag` and `ok` are status colors, never used for buttons or decoration, and
always paired with a word ("Duplicate", "High confidence").

## Typography

Font stack: `system-ui, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI",
sans-serif`. Inter (self-hosted via `@fontsource-variable/inter`) is the
fallback off Apple devices. Money uses `font-variant-numeric: tabular-nums`.

| Role | Size / weight / line-height | Letter-spacing |
|---|---|---|
| Hero number | 80px / 600 / 1.0 (48px mobile) | -0.03em |
| Hero headline | 56px / 600 / 1.07 (34px mobile) | -0.02em |
| Section headline | 40px / 600 / 1.1 (28px mobile) | -0.01em |
| Lead | 24px / 400 / 1.35 | 0 |
| Tagline | 21px / 600 / 1.2 | 0 |
| Body | 17px / 400 / 1.47 | -0.01em |
| Caption | 14px / 400 / 1.43 | 0 |
| Fine print | 12px / 400 / 1.3 | 0 |

Weights used: 400 and 600 only.

## Spacing and shape

- Base unit 8px. Tokens: 4, 8, 12, 16, 24, 32, 48, 80.
- Band padding: 80px vertical on desktop, 48px on mobile.
- Content width: 980px for reading, 1200px for the bill table.
- Radius: 8px small controls, 18px cards, pill (9999px) for buttons, tabs,
  chips and inputs.

## Components

- **Primary button**: pill, `primary` background, white 17px text,
  padding 12px 24px, `transform: scale(0.97)` on press. One per screen section.
- **Secondary button**: pill, transparent, 1px `primary` border, `primary` text.
- **Text link**: `primary`, no underline until focus.
- **Tabs**: a pill segmented control on `parchment`; the active tab is a white
  pill with `ink` text. URL keeps the tab (`?tab=`).
- **Card**: `canvas`, 1px `hairline`, radius 18px, padding 24px, no shadow.
- **Summary band** (results): dark band, hero number in `on-dark`, three small
  figures under it, one primary button.
- **Finding row**: title, amount right-aligned in tabular figures, one status
  word chip. Evidence collapsed behind "Show evidence".
- **Flagged bill line**: `flag-soft` row, `flag` amount, chip with the finding
  number and a word.
- **Inputs**: pill, `parchment` fill, 1px `hairline`, 44px tall, focus ring
  `primary-focus`.
- **Progress** (analysis): vertical list of steps, each with a check when done.

## Screens

- **Landing**: dark hero band (headline, one line, "Try with a sample bill"
  primary, "Check my bill" secondary) → light band with three steps → parchment
  band with three KFF numbers and the source.
- **Check**: two steps with a thin progress bar; one question group per screen.
- **Results**: dark summary band, then tabs on a light band: What we found ·
  Your bill · Letters · Pay less.
- **My case**: light band, timeline with checks, one primary button for the
  calendar file.

## Motion

Short and functional: 200–300ms fades and 8–16px rises on section entry, the
press scale on buttons. Nothing loops. Respect `prefers-reduced-motion`.
