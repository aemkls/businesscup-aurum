# ClaimBack design system: audit on paper

The product's one image is a paper hospital bill that someone has checked
carefully with a yellow marker and a red pen. All of the character goes into
that image; everything around it stays calm and disciplined, because people
use ClaimBack to make decisions about money and medical bills.

## Principles

- **The bill is the hero.** On the landing page and on the results page the
  user sees an itemized bill as a sheet of paper, marked up line by line. The
  marks are built from real findings (`lib/annotations.ts`), never drawn by hand
  for a fixed case.
- **Two tools, strict roles.** Yellow marker only highlights problem lines and
  numbers. Red pen only strikes out, corrects and writes short margin notes.
  Neither is used for buttons, links or decoration.
- **Color never carries meaning alone.** Every highlighted line has a word
  next to it ("billed twice", "should be 1"); every status chip is a word.
- **Paper on a desk.** The page is a cool desk; documents (bill, plan card,
  letters, case file) are white paper with a soft shadow. No cream backgrounds,
  no pure black blocks, no decorative gradients.
- **Details behind tabs.** Results use folder tabs: What we found, Your bill,
  Letters, Pay less.

## Color

| Token | Hex | Use |
|---|---|---|
| `desk` | `#E8EDF2` | Page background |
| `desk-deep` | `#D7DFE8` | Inactive folder tabs, case folder, progress track |
| `paper` | `#FFFFFF` | Bill, plan card, letters, panels |
| `bill-text` | `#1F2A37` | Text printed on paper |
| `ink` | `#13213A` | Headings and body text, the plan card header |
| `ink-muted` | `#4B5B70` | Secondary text (5.9:1 on desk, 6.9:1 on paper) |
| `rule` | `#CFD8E3` | Dashed rules on paper, input underlines |
| `marker` | `#FFE14D` | Highlight on problem lines and numbers only |
| `pen` | `#C8322B` | Strikes, corrections, margin notes, the SENT stamp (5.3:1 on paper) |
| `action` | `#1D4ED8` | Buttons and links (6.7:1 on paper, 5.7:1 on desk) |
| `ok` | `#1D7A46` | "High confidence", done progress; always with a word |

Pen text is never placed on marker yellow (4.1:1). Handwritten notes are 20px
or larger.

## Typography

| Role | Font | Notes |
|---|---|---|
| Headings | Bricolage Grotesque (variable), 700–800 | Tight tracking: hero 60px / -0.035em (40px on phones) |
| Interface text | Inter (variable) | Body 17px, caption 15px, fine print 13px |
| Bill lines and every amount | IBM Plex Mono 400/600 | Real bills are printed in monospace |
| Pen notes | Caveat 500 | Only for marks on paper, nowhere else |

All fonts are self-hosted from `@fontsource` packages, so the build needs no
network. No ALL CAPS labels; the SENT stamp is an object, not a label.
Numbering ("01", "02") only where there is a real sequence (the three steps).

## Layout and shape

- Content width 980px for reading, 1200px for the landing and results heads.
- Sections: 40px vertical padding on phones, 64px from md up. Spacing on a
  4/8px grid.
- Paper: 4px corners, drop shadow `0 1px 1px` + `0 10px 24px` at 8–10% ink,
  torn zigzag bottom edge on bills. On phones paper runs edge to edge.
- Plan card: 18px corners, ink header band ("Health plan").
- Buttons: pill, `action` fill or `action` outline on paper. One primary
  button per area.
- Inputs: mono values on a 2px underline (plan card) or pill inputs on paper.

## Components

- **Audited bill** (`components/AuditedBill.tsx`): header, columns (code from
  sm up, service, qty, amount), marked lines with a circled finding number in
  the margin, notes under the line, findings without a line as notes above the
  totals, struck amount due with the corrected total written by hand.
- **Folder tabs** (`components/results/Tabs.tsx`): labels on the edge of the
  case file; the active tab joins the paper page. `?tab=` in the URL, arrow
  keys, Home and End.
- **Finding note**: circled number, title, confidence word, who to contact,
  explanation, evidence behind "Show evidence", amount right-aligned in mono.
- **Letter stack under glass**: the paid letters as a blurred stack with a
  frosted panel and the Unlock button. The text under the glass is built only
  from free data.
- **Drop sheet**: an empty sheet with a dashed border; after a file is chosen,
  its thumbnail (or a PDF page) and name.
- **Checklist progress**: mono lines with boxes ticked in red pen.
- **Case file**: a blue-gray folder with a tab, a sheet inside, a timeline;
  a red SENT stamp with the date on letters marked as sent.

## Motion

Only two kinds of motion:

1. **One scene on load.** The landing hero and the results bill play the
   mark-up once, about three seconds: marker wipes across each problem line,
   the pen strikes and corrects, notes are written, the total is struck and
   rewritten; on the landing page the heading's last words get the marker at
   the end. Every mark is drawn from its final state with a delay (`--d`), so
   nothing loops and nothing is left half-drawn.
2. **Reactions to the user.** A button press scale, a pen tick in the
   analysis checklist, the SENT stamp when a letter is marked as sent.

No fade-ins on sections, no hover animations on cards. With
`prefers-reduced-motion: reduce` every animation is off and the finished,
fully marked page shows at once.

## Accessibility

- Text contrast at least 4.5:1 (see the table above).
- Visible keyboard focus: 2px `action` outline.
- 390px wide phones: no horizontal page scroll; paper runs edge to edge.
- Marks are real text ("billed twice"), and each circled number has a
  screen-reader label ("Finding 1").

## Voice

Plain English, active voice, short sentences. Say what happened and what to do
("Your insurer applied the full deductible"). No marketing phrases.
