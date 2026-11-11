# Stax header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app header with a "Stax by Ascendix" product bar (mark, lockup, building switcher, controls, palette menu) over a building card with a photo, drop Data issues from the header, and put the lockup on the PDF.

**Architecture:** The header stays one component, `Header`, rendered by `App.tsx`; it returns a product bar (`.sp-topbar`, standalone skins only) followed by the existing card (`.sp-header`). Brand drawings live in a new `Brand.tsx` so the PDF can reuse them. The palette menu's items come from a pure function so they can be unit-tested without a DOM (the `Menu` popover renders its items only when open).

**Tech Stack:** React 19, TypeScript, Vite, Vitest (`renderToString` + regex, as in `Header.test.tsx`), plain CSS with the app's tokens.

**Spec:** `docs/superpowers/specs/2026-11-11-header-design.md`

## Global Constraints

- Product name is exactly `Stax` (capital S, lowercase x) and the byline exactly `by Ascendix`.
- Brand colours are literal hex, never palette tokens: cyan `#00aff0`, orange `#ff9c00`, navy `#1e2d3c`, dark-theme mark square `#15212d`. In the light theme the mark's cyan bars become navy `#1e2d3c`; orange never changes. Same colours under the Vice City palette.
- No gray in the brand area (mark, lockup).
- Never draw, imitate or import the Ascendix "X" logo.
- No person's name, username or picture anywhere in UI, assets or copy.
- The photo is a generic royalty-free office tower, not the real building; its source and licence go in the README.
- `skin=classic` output is unchanged except that Data issues, the slot and the stale link are gone.
- Commit after every task on branch `feat/header-stax`, created from `origin/main`.
- Before each commit: `npm test -- --run` passes, `npm run lint` passes, `npx tsc -b` passes.

## Review Focus

1. A long building name (60+ characters) in the switcher on a 390 px phone: the name must be hidden under 760 px and never widen the bar past the viewport. Test in Task 4 (phone render has no name text in the switcher).
2. Prospect-safe on and off must give a bar of the same height: the chip takes the old fixed-width slot, which is present and empty when the mode is off. Test in Task 2.
3. The embedded skin must show no product bar, no lockup, no photo and no switcher: a CRM host page already names the building. Test in Task 4.
4. The "Custom · coming soon" entry must be unreachable by keyboard and click: `disabled: true` so `Menu` skips it in roving focus and ignores clicks. Test in Task 3.
5. Under `?palette=vice&theme=light` the lockup must still be cyan/orange on navy, not pink: the mark's colours come from literal hex in `shell.css`, keyed to `data-theme` only. Test in Task 1 (SVG markup carries the class names, CSS carries the hex; the test asserts no palette variable is used in the brand rules).

---

### Task 1: Brand drawings and the palette icon

**Files:**
- Create: `src/components/shell/Brand.tsx`
- Create: `src/components/shell/Brand.test.tsx`
- Modify: `src/components/ui/Icon.tsx` (add `'palette'` to `IconName` and `PATHS`)
- Modify: `src/components/shell/shell.css` (append a `/* ── Brand ── */` block)

**Interfaces:**
- Produces: `export function StaxMark({ size = 40 }: { size?: number }): JSX.Element` — a `<span className="sp-mark">` holding an SVG `viewBox="0 0 64 64"` with six `<rect>`s (rx 2.5) at the spec's coordinates; the five cyan bars have `className="sp-mark__bar"`, the orange one `className="sp-mark__bar sp-mark__bar--open"`. The square's size is `size` px, the SVG is `size * 0.65` px.
- Produces: `export function StaxLockup({ size }: { size?: number }): JSX.Element` — `<span className="sp-lockup"><StaxMark size={size} /><span className="sp-lockup__name">Stax</span><span className="sp-lockup__by">by Ascendix</span></span>`.
- Produces: icon name `'palette'`: a painter's palette outline with three dots, in the 24-unit stroke style of `sun`/`moon`. Path: `M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h1.8A4.5 4.5 0 0 0 21 10.2C21 6.2 17 3 12 3zM7.5 11.5h.01M10.5 7.5h.01M15 7.5h.01`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/shell/Brand.test.tsx
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { StaxLockup, StaxMark } from './Brand';
import { Icon } from '../ui';

describe('StaxMark', () => {
  it('is a 64-unit drawing of six floor bars, one of them the open suite', () => {
    const html = renderToString(<StaxMark />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html.match(/<rect /g)).toHaveLength(6);
    expect(html.match(/class="sp-mark__bar sp-mark__bar--open"/g)).toHaveLength(1);
    expect(html).toContain('x="39" y="22" width="13" height="9"');
    expect(html).not.toMatch(/fill="#/); // colour comes from CSS, keyed to the theme, never inline
  });
});

describe('StaxLockup', () => {
  it('reads "Stax" then "by Ascendix", with the mark first', () => {
    const html = renderToString(<StaxLockup />);
    const text = html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
    expect(text).toBe('|Stax|by Ascendix|');
    expect(html.indexOf('sp-mark')).toBeLessThan(html.indexOf('Stax'));
  });
});

describe('brand CSS', () => {
  const css = readFileSync(new URL('./shell.css', import.meta.url), 'utf8');
  const brand = css.slice(css.indexOf('/* ── Brand'));
  it('uses the fixed hex colours and no palette token', () => {
    for (const hex of ['#00aff0', '#ff9c00', '#1e2d3c', '#15212d']) expect(brand).toContain(hex);
    expect(brand).not.toMatch(/var\(--sp-color-brand/);
    expect(brand).toMatch(/\[data-theme='light'\][^{]*\.sp-mark__bar\s*\{[^}]*fill:\s*#1e2d3c/);
  });
});

describe('palette icon', () => {
  it('exists in the icon set', () => {
    expect(renderToString(<Icon name="palette" />)).toContain('<path d="M12 3a9 9');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/shell/Brand.test.tsx`
Expected: FAIL, `Brand` module not found and `'palette'` not assignable to `IconName`.

- [ ] **Step 3: Implement `StaxMark` and `StaxLockup` in `Brand.tsx`; add `palette` to `Icon.tsx`**

Rect coordinates, in order: `(12,10,40,9)`, `(12,22,24,9)`, `(39,22,13,9)` open, `(12,34,14,9)`, `(29,34,23,9)`, `(12,46,40,9)`. No `fill` attributes.

- [ ] **Step 4: Append the brand CSS to `shell.css`**

Rules, literal hex only:
- `.sp-mark { display:inline-grid; place-items:center; border-radius:28%; background:#1e2d3c; flex:none }`, `:root[data-theme='dark'] .sp-mark, :root:not([data-theme='light']) .sp-mark { background:#15212d; box-shadow:0 0 0 1px rgba(255,255,255,.1) }`
- `.sp-mark__bar { fill:#00aff0 }`, `.sp-mark__bar--open { fill:#ff9c00 }`, `:root[data-theme='light'] .sp-mark__bar { fill:#1e2d3c }`, `:root[data-theme='light'] .sp-mark__bar--open { fill:#ff9c00 }`
- `.sp-lockup { display:inline-flex; align-items:center; gap:10px }`, `.sp-lockup__name { font-weight:800; font-size:21px; line-height:1; letter-spacing:-.02em; color:#00aff0 }`, `.sp-lockup__by { font-weight:600; font-size:13px; line-height:1; color:#1e2d3c; margin-left:-1px }`, `:root:not([data-theme='light']) .sp-lockup__by { color:#fff }`. The name and the byline share a baseline: wrap both in `display:inline-flex; align-items:baseline; gap:9px`.

Check how `tokens.css` keys the theme (`:root:not([data-theme='light'])` is dark by default, `:root[data-theme='dark']` explicit) and mirror it exactly.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/shell/Brand.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/Brand.tsx src/components/shell/Brand.test.tsx src/components/ui/Icon.tsx src/components/shell/shell.css
git commit -m "feat(header): Stax mark, lockup and palette icon"
```

---

### Task 2: Remove Data issues from the header

**Files:**
- Modify: `src/components/shell/Header.tsx` (the `sp-header__slot` block and the `sp-header__stale` button)
- Modify: `src/components/shell/Header.test.tsx` (the "one slot holds Data issues…" test)
- Modify: `src/components/shell/shell.css` (`.sp-header__stale` rule and the comment about the slot)

**Interfaces:**
- Produces: `.sp-header__slot` is always rendered inside `.sp-header__actions`; it holds the "Prospect-safe on" `Chip` when `state.safe`, nothing otherwise. Width rules unchanged.

- [ ] **Step 1: Rewrite the slot test**

Replace the test `'one slot holds Data issues or, in prospect-safe, the chip that says the mode is on'` with:

```tsx
it('the slot is empty, or holds the chip that says prospect-safe is on; Data issues is not in the header', () => {
  const slot = (query: string) => /<div class="sp-header__slot">(.*?)<\/div>/.exec(actions(query))?.[1] ?? 'MISSING';
  expect(slot('')).toBe('');
  expect(text(slot('?safe=1'))).toBe('Prospect-safe on');
  for (const q of ['', '?safe=1', '?skin=classic', '?skin=aurora']) {
    expect(render(q).html, q).not.toContain('Data issues');
    expect(render(q).html, q).not.toContain('sp-header__stale');
  }
  const title = (query: string) => { const { html } = render(query); return text(html.slice(html.indexOf('class="sp-header__title"'), html.indexOf('class="sp-header__facts"'))); };
  expect(title('?safe=1')).toBe(title(''));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shell/Header.test.tsx -t "slot is empty"`
Expected: FAIL, slot contains `Data issues`.

- [ ] **Step 3: Remove the button and the stale link in `Header.tsx`**

Delete the `Button icon="warning"` branch (keep the `div.sp-header__slot` wrapper, render `null` when not safe), delete the `sp-header__stale` button and the `staleRecords`/`issueTotal` variables, keep `staleDays` for the `--stale` class and the `clock`/`check` icon (`clock` when `staleDays > 30`). Remove the now-unused imports (`rememberTrigger`, `Button` if unused — it is still used by Export). Update the comment above the slot.

- [ ] **Step 4: Run the whole header suite**

Run: `npx vitest run src/components/shell`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/Header.tsx src/components/shell/Header.test.tsx src/components/shell/shell.css
git commit -m "feat(header): remove Data issues button and stale link from the header"
```

---

### Task 3: Palette icon menu

**Files:**
- Create: `src/components/shell/paletteMenu.ts`
- Create: `src/components/shell/paletteMenu.test.ts`
- Modify: `src/components/shell/Header.tsx` (desktop `sp-header__look` and the phone "Colors and theme" menu)
- Modify: `src/components/shell/Header.test.tsx` (`describe('Header palette control')` and the phone tests)
- Modify: `src/components/shell/shell.css` (drop the `.sp-palette .sp-segmented__*` rules; keep `.sp-palette__dot*`)

**Interfaces:**
- Produces: `export function paletteMenuItems(current: Palette, patch: (p: Partial<PlanState>) => void): MenuItem[]` returning, in order: heading `{ kind:'heading', id:'palette', label:'Colors' }`, one item per `PALETTES` entry `{ id:'palette-<id>', label, adornment: <span className="sp-palette__dot sp-palette__dot--<id>" aria-hidden="true" />, checked: id === current, onSelect: () => patch(palettePatch(id)) }`, then `{ id:'palette-custom', label:'Custom', hint:'coming soon', disabled:true, adornment: <span className="sp-palette__dot sp-palette__dot--custom" aria-hidden="true" />, onSelect: () => {} }`. (File is `.tsx` if the adornment is JSX: name it `paletteMenu.tsx`.)
- Produces: in the desktop look group, a `Menu` with `label="Colors"` whose trigger is `<Button iconOnly icon="palette" aria-label="Colors" title="Colors" />`, rendered only when `paletteOf(state) !== null`; it stands before the theme toggle.
- The phone "Colors and theme" menu uses `paletteMenuItems` for its palette section instead of its own mapping.

- [ ] **Step 1: Write the failing unit test for `paletteMenuItems`**

```ts
// src/components/shell/paletteMenu.test.tsx
import { describe, expect, it } from 'vitest';
import { paletteMenuItems } from './paletteMenu';

describe('paletteMenuItems', () => {
  it('lists Ascendix, Vice City and a disabled Custom, under a Colors heading', () => {
    const items = paletteMenuItems('ascendix', () => {});
    expect(items.map((i) => ('label' in i ? i.label : i.kind))).toEqual(['Colors', 'Ascendix', 'Vice City', 'Custom']);
    expect(items[0]).toMatchObject({ kind: 'heading' });
    expect(items[1]).toMatchObject({ checked: true });
    expect(items[2]).toMatchObject({ checked: false });
    expect(items[3]).toMatchObject({ disabled: true, hint: 'coming soon' });
  });
  it('marks Vice City when it is current, and selecting a palette writes the patch', () => {
    const patches: unknown[] = [];
    const items = paletteMenuItems('vice', (p) => patches.push(p));
    expect(items[2]).toMatchObject({ checked: true });
    (items[1] as { onSelect: () => void }).onSelect();
    (items[2] as { onSelect: () => void }).onSelect();
    expect(patches).toEqual([{ palette: undefined }, { palette: 'vice' }]);
  });
});
```

- [ ] **Step 2: Rewrite the header palette tests**

Replace `describe('Header palette control')` with:

```tsx
describe('Header palette control', () => {
  const look = (query: string) => /<div class="sp-header__look">(.*?)<\/div>/.exec(render(query).html)?.[1] ?? null;
  it('is an icon button that opens the Colors menu, before the theme switch', () => {
    const l = look('')!;
    expect(l).toMatch(/<button[^>]*aria-label="Colors"[^>]*aria-haspopup="menu"/);
    expect(l).not.toContain('role="radiogroup"');
    expect(l.indexOf('aria-label="Colors"')).toBeLessThan(l.indexOf('theme"'));
  });
  it('is not offered by the skins that have no palette; the embedded skin has no look controls at all', () => {
    expect(look('?skin=aurora')).not.toContain('aria-label="Colors"');
    expect(look('?skin=aurora')).toMatch(/theme"/);
    expect(look('?skin=classic')).toBeNull();
  });
});
```

In the phone tests replace every `'aria-label="Color palette"'` with `'aria-label="Colors"'`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/components/shell`
Expected: FAIL on `paletteMenu` not found and the look assertions.

- [ ] **Step 4: Implement `paletteMenuItems` and swap the `Segmented` for the `Menu` in `Header.tsx`**

Remove the `Segmented` import from `Header.tsx` if nothing else uses it there. Add `.sp-palette__dot--custom { background: conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171); opacity:.5 }` in `shell.css`.

- [ ] **Step 5: Run the suite**

Run: `npx vitest run src/components/shell`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/paletteMenu.tsx src/components/shell/paletteMenu.test.tsx src/components/shell/Header.tsx src/components/shell/Header.test.tsx src/components/shell/shell.css
git commit -m "feat(header): palette icon menu with Custom coming soon"
```

---

### Task 4: Product bar, building switcher and building card with photo

**Files:**
- Create: `src/data/mock/portfolio.ts`
- Create: `src/components/shell/switcher.tsx`
- Create: `src/assets/building.jpg`
- Modify: `src/components/shell/Header.tsx`
- Modify: `src/components/shell/Header.test.tsx`
- Modify: `src/components/shell/shell.css` (header layout)
- Modify: `README.md` (Assumptions → Data: photo credit line)

**Interfaces:**
- Consumes: `StaxLockup` (Task 1), `paletteMenuItems` (Task 3), the slot (Task 2).
- Produces: `export const PORTFOLIO: ReadonlyArray<{ id: string; name: string; city: string }>` in `portfolio.ts`: five fictional entries after the live one — `Legacy West Tower II / Plano, TX`, `Galleria Commerce Plaza / Dallas, TX`, `Trinity Riverfront Offices / Fort Worth, TX`, `Cedar Springs Exchange / Dallas, TX`, `Las Colinas Gateway / Irving, TX`.
- Produces: `Header` returns `<>{standalone && <div className="sp-card sp-topbar sp-no-print">…</div>}<header className="sp-card sp-header sp-no-print">…</header></>`.
  - `.sp-topbar` children in order: `StaxLockup`, `span.sp-topbar__divider`, the switcher `Menu` (`label="Building"`, trigger `<Button icon="chevron-down" iconRight … aria-label="Switch building">` whose children are `<img className="sp-switcher__thumb" src={photo} alt="" />` and `<span className="sp-switcher__name">{property.name}</span>`), `div.sp-header__actions` (as-of, switch, slot, Export, phone "more" menu), `div.sp-header__look` (palette menu, theme toggle; desktop only).
  - Switcher items: heading `Portfolio · 6 buildings`, the current building `{ checked: true, hint: property.city + ', ' + property.state, onSelect: () => {} }`, the five `PORTFOLIO` entries `{ disabled: true, hint: city, onSelect: () => {} }`, then `{ kind:'separator' }`, `{ id:'sample', label:'Sample entries: only the first building opens', disabled:true, onSelect: () => {} }`.
  - `.sp-header` (the card) in standalone: `<img className="sp-header__photo" src={photo} alt="" width={80} height={80} />`, then `div.sp-header__text` with `.sp-header__title` (`<h1>{property.name}</h1>` only, no "Stacking plan" span) and `.sp-header__facts` unchanged. No actions, no look.
  - `.sp-header` in classic: exactly today's markup minus Data issues (icon box, title "Stacking plan" + property link, facts, actions with the slot). Photo, bar and lockup absent.

- [ ] **Step 1: Get the photo**

Pick a royalty-free photo of a generic glass office tower (Unsplash licence or CC0), with no readable signage. Save it as `src/assets/building.jpg` and resize to 640 px wide: `sips -Z 640 src/assets/building.jpg`. Record the photographer/page URL for the README. If `import photo from '../../assets/building.jpg'` fails type-checking, add `/// <reference types="vite/client" />` to `src/vite-env.d.ts`.

- [ ] **Step 2: Write the failing tests**

Append to `Header.test.tsx`:

```tsx
describe('Header product bar and building card', () => {
  const bar = (query: string) => /<div class="sp-card sp-topbar sp-no-print">(.*?)<\/div><header/.exec(render(query).html)?.[1] ?? null;
  const strip = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('standalone: the bar carries the lockup, the switcher, the controls and the look, in that order', () => {
    const b = bar('')!;
    for (const [a, c] of [['sp-lockup', 'sp-switcher__name'], ['sp-switcher__name', 'sp-header__actions'], ['sp-header__actions', 'sp-header__look']])
      expect(b.indexOf(a), `${a} before ${c}`).toBeLessThan(b.indexOf(c));
    expect(strip(b)).toMatch(/^Stax by Ascendix Preston Park Financial Center/);
    expect(b).toMatch(/<button[^>]*aria-label="Switch building"[^>]*aria-haspopup="menu"/);
  });

  it('standalone: the card is the photo, the name and the facts; the controls are not in it', () => {
    const { html } = render('');
    const card = html.slice(html.indexOf('<header'));
    expect(card).toContain('class="sp-header__photo"');
    expect(card).not.toContain('sp-header__actions');
    expect(card).not.toContain('sp-header__icon');
    expect(strip(card.slice(card.indexOf('sp-header__title'), card.indexOf('sp-header__facts')))).toBe('Preston Park Financial Center');
  });

  it('aurora gets the bar too; the embedded skin gets none of it', () => {
    expect(bar('?skin=aurora')).toContain('sp-lockup');
    expect(bar('?skin=classic')).toBeNull();
    const classic = render('?skin=classic').html;
    for (const s of ['sp-lockup', 'Stax', 'sp-header__photo', 'Switch building']) expect(classic).not.toContain(s);
    expect(classic).toContain('class="sp-header__icon"');
    expect(classic).toContain('sp-header__actions');
  });

  it('the switcher menu lists the live building checked and five disabled sample entries', () => {
    // Menu renders its items only when open: test the items through the helper the header builds them with.
    const items = switcherItems(property);
    const labels = items.filter((i) => !('kind' in i) || i.kind === 'item').map((i) => (i as { label: string }).label);
    expect(labels[0]).toBe('Preston Park Financial Center');
    expect(labels.slice(1, 6)).toEqual(['Legacy West Tower II', 'Galleria Commerce Plaza', 'Trinity Riverfront Offices', 'Cedar Springs Exchange', 'Las Colinas Gateway']);
    expect(items[1]).toMatchObject({ checked: true });
    for (const i of items.slice(2, 7)) expect(i).toMatchObject({ disabled: true });
  });
});
```

`switcherItems` is `export function switcherItems(property: Property): MenuItem[]` in a new `src/components/shell/switcher.tsx` (import `Property` from `../../domain/types`, `MenuItem` from `../ui/Menu`); the test imports it from `./switcher`, and `Header.tsx` calls it. Also extend the phone test `'760 px and under'` with `expect(html).not.toContain('sp-switcher__name')` is **not** possible in SSR (CSS hides it): instead assert the name span has class `sp-switcher__name` and add the rule `@media (max-width: 760px) { .sp-switcher__name { display:none } }`; the visual check in Task 6 covers it.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/components/shell/Header.test.tsx`
Expected: FAIL, no `sp-topbar`.

- [ ] **Step 4: Restructure `Header.tsx`**

Standalone branch renders the bar + the simplified card; classic branch renders today's card minus Data issues. Keep `useToastBoundary(state.safe)`, `AsOfPopover`, the `Switch`, Export and the phone menu exactly as they are, only moved.

- [ ] **Step 5: Rewrite the header layout in `shell.css`**

Replace the `/* ── Header ── */` block's layout rules (keep `.sp-header__facts`, `__sale`, `__verified`, `__slot`, `__asof*`, `.sp-palette__dot*`):
- `.sp-topbar { display:flex; align-items:center; gap:12px; padding:8px 16px; flex-wrap:wrap }`, `.sp-topbar__divider { width:1px; height:30px; background:var(--sp-color-border-strong) }`, `.sp-topbar .sp-header__actions { margin-left:auto }`.
- `.sp-switcher__thumb { width:26px; height:26px; border-radius:7px; object-fit:cover }`, `.sp-switcher__name { font-weight:600; max-width:32ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }`.
- `.sp-header { display:flex; align-items:center; gap:16px; padding:16px 20px }`, `.sp-header__photo { width:80px; height:80px; border-radius:12px; object-fit:cover; flex:none }`, `.sp-header__title h1 { font-size:var(--sp-text-22) }`.
- Classic keeps the old grid: scope the existing `@media (min-width:1181px)` grid rules and the `.sp-header__icon` rule to `.sp-header--classic` (add that class in the classic branch).
- Phone (`max-width:760px`): `.sp-switcher__name { display:none }`, `.sp-topbar { padding:8px 12px; gap:8px }`, `.sp-header__photo { width:56px; height:56px }`, `.sp-lockup__by { display:none }`.
- Delete the `.sp-header__look` grid-area rules for standalone (they live in the bar now).

- [ ] **Step 6: README credit**

Under `## Assumptions` → **Data**, add: `- The building photo is a stock image of a generic office tower (<photographer>, <site>, <licence>), not the real building.`

- [ ] **Step 7: Run everything**

Run: `npx vitest run && npm run lint && npx tsc -b`
Expected: all PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell src/data/mock/portfolio.ts src/assets/building.jpg README.md src/vite-env.d.ts
git commit -m "feat(header): Stax product bar with building switcher, and a building card with a photo"
```

---

### Task 5: Lockup on the PDF cover

**Files:**
- Modify: `src/components/print/PrintLayout.tsx` (the `sp-print__head` header)
- Modify: `src/components/print/print.css`
- Modify: `src/components/print/PrintLayout.test.tsx`

**Interfaces:**
- Consumes: `StaxLockup` (Task 1).
- Produces: inside `<header className="sp-print__head">`, a new first child `<div className="sp-print__brand"><StaxLockup size={28} /></div>` before the title `div`; the cover order test keeps `sp-print__head` where it is.

- [ ] **Step 1: Write the failing test**

Add to `describe('PrintLayout')`:

```tsx
it('the cover head opens with the Stax lockup, before the building name, in every report', () => {
  for (const q of ['', '?safe=1', '?skin=classic']) {
    const html = cover(q); // use the file's existing render helper for the cover section
    const head = /<header class="sp-print__head">(.*?)<\/header>/.exec(html)![1];
    expect(head.startsWith('<div class="sp-print__brand">')).toBe(true);
    expect(head.indexOf('sp-lockup')).toBeLessThan(head.indexOf('<h1>'));
    expect(head).toContain('Stax');
    expect(head).toContain('by Ascendix');
  }
});
```

(Adapt `cover(q)` to whatever helper the file uses to render a section for a query; the existing tests show it.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/print/PrintLayout.test.tsx -t "Stax lockup"`
Expected: FAIL.

- [ ] **Step 3: Add the lockup and its print rules**

`print.css`: `.sp-print__brand { margin-right:16px; print-color-adjust:exact; -webkit-print-color-adjust:exact }`, `.sp-print__head .sp-mark { background:#1e2d3c }`, `.sp-print__head .sp-mark__bar { fill:#00aff0 }`, `.sp-print__head .sp-mark__bar--open { fill:#ff9c00 }`, `.sp-print__head .sp-lockup__by { color:#1e2d3c }` (print is always white paper, so override the theme rules).

- [ ] **Step 4: Run the print suite**

Run: `npx vitest run src/components/print`
Expected: PASS, including the cover-order test.

- [ ] **Step 5: Commit**

```bash
git add src/components/print
git commit -m "feat(print): Stax lockup on the PDF cover"
```

---

### Task 6: Page title, visual check, PR

**Files:**
- Modify: `index.html` (`<title>Stax · Stacking plan</title>`)

- [ ] **Step 1: Set the title and commit**

```bash
git add index.html && git commit -m "chore: page title names the product"
```

- [ ] **Step 2: Visual check in the browser**

Run: `npm run dev` and open the URL, then check each of these and fix anything off before continuing:
- `/`: light and dark theme (toggle), Ascendix and Vice City palettes via the palette icon; the lockup stays cyan/orange/navy under Vice.
- Switcher open: live entry checked, five greyed entries, the sample note; nothing navigates.
- Prospect-safe on/off: bar height identical (measure in devtools).
- Window at 390 px, 760 px, 1024 px, 1440 px: no horizontal scroll, the name hidden under 760, the facts hidden under 760 as before.
- `?skin=classic`: old card, no bar, no photo, no Data issues.
- Export → PDF report: the lockup prints in colour at the top left of the cover.

- [ ] **Step 3: Full check and push**

Run: `npx vitest run && npm run lint && npm run build`
Expected: PASS, build succeeds.

```bash
git push -u origin feat/header-stax
```

Then open a PR against `main` titled `Header: Stax by Ascendix product bar, building switcher, photo, palette menu` with a body that lists the spec path, the five bullets from the spec's Goals, and the review decisions. End the body with the attribution line in force for this session.
