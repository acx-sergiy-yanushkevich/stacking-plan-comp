# Header redesign: "Stax by Ascendix"

Date: 2026-11-11. Status: approved for planning.

## Intent

The header should tell a broker, in the first second, two things: this is a finished product, and it works for any building, not just the one on screen. Today the header is a generic building icon, the building name, a facts row and a row of controls. It has no product identity and nothing says there is more than one building. The team agreed on 2026-11-11 that the header is one team member's task and that the Data issues button goes.

## Goals

- Give the app a product identity: a mark and the name "Stax by Ascendix", in Ascendix colours.
- Say "built for many buildings" through a building switcher, without adding a second real building.
- Replace the palette segmented control with a palette icon that opens a menu, and show "Custom" as coming soon.
- Remove Data issues from the header.

## Non-goals

- A second working building. The switcher lists other buildings but only the current one opens.
- Working custom colours or client branding. "Custom · coming soon" is a disabled menu entry.
- Any change to the embedded (`skin=classic`) header. The host page names the building there; the product bar does not apply.
- Removing the Data issues *mode* from the app. Only its header button goes. (The `issues` mode, the model and the tests of it can stay; another entry point is not required.)

## Anti-goals

- The Ascendix "X" logo must not be copied or imitated. The mark is a new drawing that uses the same colours.
- No gray in the brand area. The lockup uses only navy, white, cyan and orange.
- No person's name, username or picture anywhere (challenge anonymity rule).

## The design

Direction A: a thin **product bar** above a **building card**.

### Product bar (standalone skin only)

Left to right:

1. **Mark**: a 40×40 navy (#1E2D3C) rounded square (radius ~11px) holding a 26px SVG of a small stacking plan: four floor bars, the second and third split into two suites, one suite orange (#FF9C00), everything else cyan (#00AFF0). Reference drawing (viewBox 0 0 64 64, rx 2.5 on every rect):
   - `(12,10) 40×9` cyan
   - `(12,22) 24×9` cyan, `(39,22) 13×9` orange
   - `(12,34) 14×9` cyan, `(29,34) 23×9` cyan
   - `(12,46) 40×9` cyan
   The bars stay cyan in both themes (they sit on the navy square). In the dark theme the square is a darker navy (#15212D) with a 1px white 10% ring so it separates from the page.
2. **Lockup B**: "Stax" (capital S, lowercase x) in 800 weight, ~21px, letter-spacing −0.02em, cyan; then "by Ascendix" in 600 weight, ~13px, navy (light) or white (dark). Both on one baseline, 9px apart, the pair vertically centred on the mark.
3. A 1px vertical divider.
4. **Building switcher**: a button with the building name and a chevron (no photo, no icon). Opening it shows a menu titled "PORTFOLIO · 6 BUILDINGS": the current building highlighted and checked, then five more entries in disabled style (name left, city right) and a last line "sample entries". The disabled entries are fictional Dallas-area office names and do not navigate. Builder's call on the exact names; they must not be real buildings or companies.
5. Spacer.
6. **Controls**, unchanged in behaviour: as-of popover, Prospect-safe switch, Export menu. Then:
7. **Palette icon button** (icon-only, same size as the theme toggle): opens a menu "COLORS" with Ascendix, Vice City, and "Custom · coming soon" (disabled). Each entry keeps the existing palette dot adornment. The icon is a new line icon in the app's icon set, a painter's palette outline with three small dots, same stroke as `sun`/`moon`. Selecting a palette does what the segmented control did (`palettePatch`).
8. **Theme toggle**, unchanged.

The Prospect-safe chip that today shares a slot with Data issues stays and takes the slot alone: it is what tells a broker the mode is on. The fixed slot width that kept the header height stable with the mode on and off can go if nothing wraps differently; the builder checks the header height is the same in both modes at the breakpoints `shell.css` already names.

On a phone the existing "more" menu keeps the palette and theme entries; the palette icon is desktop only. The building switcher collapses to the chevron.

### Building card

The current header card, lighter:

- The building icon box stays (the user chose it over a photo on 2026-11-11).
- Title: the building name (h1). The facts row starts flush with the title.
- Facts row, as today: class, address, leasable RSF, floors, sale listing (with the prospect-safe variant), "Latest change". The "N records stale" link goes with Data issues.
- The right-hand controls and the look controls move up to the product bar, so the card is text and photo only.

### Photo

None. A stock photo was tried and dropped on 2026-11-11; the icon box stays.

### Exports

The PDF report header should carry the lockup (mark + "Stax by Ascendix") in place of whatever icon it uses now, if any. Nothing else in the exports changes.

## Decisions from the review (2026-11-11)

- **Colours are fixed.** The mark and the lockup always use the Ascendix hex values above, in both themes and under both palettes (Ascendix and Vice City). They do not follow palette tokens. The builder checks contrast of the lockup on the Vice City light page and may darken the "by Ascendix" text there, but the cyan and orange stay.
- **Data issues leaves the header in every skin**, including `classic`. One code path. The `classic` tests that expect the button, the slot and the stale link are updated; the rest of the classic output stays as it is.
- **Aurora skin** gets the same product bar as the default skin. The palette icon is not rendered there (aurora has no palette, as today); the theme toggle stays.
- **PDF**: the lockup appears on every PDF, from every skin.

## Constraints

- Keep the existing state model: palette stays a URL-encoded `PlanState` field; no new state for the switcher (it is display only).
- Keep `Header.test.tsx` passing or update it to the new structure; the tests of the sale listing in the facts row, the prospect-safe slot and the export menu must survive in spirit.
- Keep the `classic` skin output unchanged apart from the Data issues removal above.
- Deadline: implementation complete by Fri 2026-11-13; this is one of three tasks for that day.

## Left to the builder

- Exact spacing, breakpoints and how the switcher collapses on narrow widths.
- The palette icon path.
- The fictional building names and cities.
- Whether the PDF header gets the SVG mark or a PNG rasterised from it.
