import { describe, expect, it } from 'vitest';
import { TODAY } from '../data/mock/property';
import { DEFAULT_STATE, applyPatch, defaultState, deriveMode, enterSafe, isDark, palettePatch, paletteOf, parseState, safeState, serializeState, type PlanState } from './planState';

describe('parseState', () => {
  it('reads every supported field', () => {
    const s = parseState('?lens=expiry&asOf=2028-01-01&req=12000&window=12&view=timeline', TODAY);
    expect(s.lens).toBe('expiry');
    expect(s.asOf).toBe('2028-01-01');
    expect(s.safe).toBe(false);
    expect(s.req).toBe(12000);
    expect(s.window).toBe('12');
    expect(s.view).toBe('timeline');
    expect(s.select).toBeNull();
    expect(s.q).toBe('');
    expect(s.mode).toBe('building');
  });
  it('falls back to defaults for unknown enum values and malformed dates', () => {
    const s = parseState('?lens=bogus&asOf=nope&view=globe&window=7&mode=xyz&theme=sepia', TODAY);
    expect(s.lens).toBe('status');
    expect(s.asOf).toBe(TODAY);
    expect(s.view).toBe('building');
    expect(s.window).toBeNull();
    expect(s.mode).toBe('building');
    expect(s.theme).toBeNull();
  });
  it('rejects non-positive, non-finite or non-numeric numbers', () => {
    expect(parseState('?req=0&max=-5&bucket=abc', TODAY)).toMatchObject({ req: null, max: null, bucket: null });
    expect(parseState('?req=Infinity&max=1e400', TODAY)).toMatchObject({ req: null, max: null });
    expect(parseState('?req=12000.5&bucket=3', TODAY)).toMatchObject({ req: 12000.5, bucket: 3 });
  });
  it('treats flags as true only when exactly 1', () => {
    expect(parseState('?safe=true&live=yes', TODAY)).toMatchObject({ safe: false, live: false });
    expect(parseState('?safe=1&live=1', TODAY)).toMatchObject({ safe: true, live: true });
  });
  it('accepts a search string without the leading ?', () => {
    expect(parseState('lens=rent', TODAY).lens).toBe('rent');
    expect(parseState('', TODAY)).toEqual(defaultState(TODAY));
  });
  it('decodes free text', () => {
    expect(parseState('?q=anadarko%20drilling&select=L13-U1', TODAY)).toMatchObject({ q: 'anadarko drilling', select: 'L13-U1' });
  });
});

describe('serializeState', () => {
  it('serialises the default state to an empty string', () => {
    expect(serializeState(DEFAULT_STATE, TODAY)).toBe('');
    expect(serializeState(defaultState(TODAY), TODAY)).toBe('');
  });
  it('omits defaults and uses 1 for flags', () => {
    const qs = serializeState({ ...defaultState(TODAY), safe: true, live: true, lens: 'expiry' }, TODAY);
    expect(qs).toBe('?lens=expiry&safe=1&live=1');
  });
  it('omits asOf when it equals today', () => {
    expect(serializeState({ ...defaultState(TODAY), asOf: TODAY }, TODAY)).toBe('');
    expect(serializeState({ ...defaultState(TODAY), asOf: '2028-01-01' }, TODAY)).toBe('?asOf=2028-01-01');
  });
  it('round-trips a fully populated state', () => {
    const s: PlanState = {
      view: 'map',
      lens: 'rent',
      asOf: '2027-06-01',
      select: 'L13-U1',
      floor: 'F6',
      safe: false,
      req: 12000,
      max: 15000,
      by: '2027-09-01',
      fit: 'sublease',
      window: '180',
      bucket: 0,
      inquiry: 'I02',
      q: 'suite 600 & more',
      mode: 'area',
      live: true,
      census: 'income',
      theme: 'dark',
    };
    const qs = serializeState(s, TODAY);
    expect(qs.startsWith('?')).toBe(true);
    expect(parseState(qs, TODAY)).toEqual(s);
  });
  it('round-trips a prospect-safe state: what the mode holds survives, what it never holds is absent', () => {
    const s: PlanState = { ...defaultState(TODAY), view: 'stack', lens: 'rent', safe: true, select: 'A02', req: 12000, by: '2027-09-01', fit: 'direct', theme: 'light' };
    const qs = serializeState(s, TODAY);
    expect(qs).toContain('safe=1');
    expect(parseState(qs, TODAY)).toEqual(s);
  });
});

describe('the prospect-safe boundary in the state layer', () => {
  const d = defaultState(TODAY);

  it('a link opened with safe on drops the search: a tenant name never reaches the search box or the URL', () => {
    const s = parseState('?safe=1&q=cirrus&view=stack', TODAY);
    expect(s).toMatchObject({ safe: true, q: '', view: 'stack' });
    expect(serializeState(s, TODAY)).toBe('?view=stack&safe=1');
    // Without the mode the same link keeps its search.
    expect(parseState('?q=cirrus&view=stack', TODAY).q).toBe('cirrus');
  });

  it('a link opened with safe on has no worklist, expiry highlight or issues panel', () => {
    expect(parseState('?safe=1&window=12', TODAY)).toMatchObject({ window: null, mode: 'building' });
    expect(parseState('?safe=1&window=risk&mode=worklist', TODAY)).toMatchObject({ window: null, mode: 'building' });
    expect(parseState('?safe=1&bucket=0', TODAY).bucket).toBeNull();
    expect(parseState('?safe=1&mode=issues', TODAY).mode).toBe('building');
    // The finder, a selection and the area panel are a prospect's own business: kept.
    expect(parseState('?safe=1&req=12000&select=A02&mode=area', TODAY)).toMatchObject({ req: 12000, select: 'A02', mode: 'area' });
  });

  it('turning the mode on drops a search in progress, the worklist and the highlight in the same change', () => {
    const before: PlanState = { ...d, q: 'vantage', window: '12', mode: 'worklist', bucket: 2, select: 'L13-U1' };
    const after = applyPatch(before, { safe: true });
    expect(after).toMatchObject({ safe: true, q: '', window: null, bucket: null, mode: 'building', select: 'L13-U1' });
  });

  it('typing a suite or floor while the mode is on works', () => {
    const on = applyPatch(d, { safe: true });
    expect(applyPatch(on, { q: '350' }).q).toBe('350');
    expect(applyPatch(on, { q: 'Floor 8' }).q).toBe('Floor 8');
  });

  it('no control can open the worklist, a rollover highlight or the issues panel while the mode is on', () => {
    const on = applyPatch(d, { safe: true });
    expect(applyPatch(on, { lens: 'expiry', mode: 'worklist', window: '12' })).toMatchObject({ lens: 'status', mode: 'building', window: null });
    expect(applyPatch(on, { bucket: 0 }).bucket).toBeNull();
    expect(applyPatch(on, { mode: 'issues' }).mode).toBe('building');
    expect(applyPatch(on, { mode: 'find', req: 5000 })).toMatchObject({ mode: 'find', req: 5000 });
  });

  it('turning the mode off restores nothing and changes nothing else', () => {
    const on = applyPatch({ ...d, q: 'vantage' }, { safe: true });
    expect(applyPatch(on, { safe: false })).toEqual({ ...d, safe: false });
  });

  it('a link opened with safe on ignores its as-of date: the plan is today\'s, and the URL says so', () => {
    for (const asOf of ['2027-04-15', '2028-01-01', '2025-01-01']) {
      const s = parseState(`?safe=1&asOf=${asOf}&view=stack`, TODAY);
      expect(s, asOf).toMatchObject({ safe: true, asOf: TODAY, view: 'stack' });
      expect(serializeState(s, TODAY)).toBe('?view=stack&safe=1');
    }
    // Without the mode the same link keeps its date.
    expect(parseState('?asOf=2027-04-15&view=stack', TODAY).asOf).toBe('2027-04-15');
  });

  it('turning the mode on returns a projected plan to today, and no control can move the date while it is on', () => {
    const projected: PlanState = { ...d, asOf: '2027-04-15' };
    const on = applyPatch(projected, { safe: true }, TODAY);
    expect(on).toMatchObject({ safe: true, asOf: TODAY });
    // The as-of popover, the timeline cursor and the map's presenter all go through applyPatch.
    for (const asOf of ['2027-02-01', '2030-06-01', '2026-01-01']) expect(applyPatch(on, { asOf }, TODAY).asOf, asOf).toBe(TODAY);
    expect(applyPatch(on, { asOf: '2028-01-01', lens: 'rent' }, TODAY)).toMatchObject({ asOf: TODAY, lens: 'rent' });
    // Turning the mode off does not bring the old date back; from there the date moves again.
    const off = applyPatch(on, { safe: false }, TODAY);
    expect(off.asOf).toBe(TODAY);
    expect(applyPatch(off, { asOf: '2028-01-01' }, TODAY).asOf).toBe('2028-01-01');
    // Outside the mode nothing is pinned.
    expect(applyPatch(projected, { lens: 'rent' }, TODAY).asOf).toBe('2027-04-15');
  });

  it('a link opened with safe on drops a matched inquiry: another prospect\'s size and date never become the requirement', () => {
    const s = parseState('?safe=1&inquiry=I02&view=stack', TODAY);
    expect(s).toMatchObject({ safe: true, inquiry: null, req: null, max: null, by: null, view: 'stack' });
    expect(serializeState(s, TODAY)).toBe('?view=stack&safe=1');
    expect(deriveMode(s)).toBe('building');
    // Without the mode the same link keeps it, and opens the finder.
    const open = parseState('?inquiry=I02&view=stack', TODAY);
    expect(open.inquiry).toBe('I02');
    expect(deriveMode(open)).toBe('find');
    // A requirement the broker typed is not an inquiry: it survives the link.
    expect(parseState('?safe=1&inquiry=I02&req=12000&by=2027-06-01', TODAY)).toMatchObject({ inquiry: null, req: 12000, by: '2027-06-01' });
  });

  it('turning the mode on clears a matched inquiry at once, and none can be matched while it is on', () => {
    const matching: PlanState = { ...d, view: 'stack', mode: 'find', inquiry: 'I02', select: 'A08' };
    const on = applyPatch(matching, { safe: true }, TODAY);
    expect(on).toMatchObject({ safe: true, inquiry: null, mode: 'find', select: 'A08' });
    expect(serializeState(on, TODAY)).not.toContain('inquiry');
    // The finder's own controls, a link handler, anything: the inquiry cannot be set.
    expect(applyPatch(on, { inquiry: 'I02' }, TODAY).inquiry).toBeNull();
    expect(applyPatch(on, { inquiry: 'I01', req: null, max: null, by: null }, TODAY)).toMatchObject({ inquiry: null, req: null });
    expect(safeState({ ...d, safe: true, inquiry: 'I02' }).inquiry).toBeNull();
    // Turning the mode off does not bring it back.
    expect(applyPatch(on, { safe: false }, TODAY).inquiry).toBeNull();
    // Outside the mode it is matched as before.
    expect(applyPatch(d, { inquiry: 'I02' }, TODAY).inquiry).toBe('I02');
  });

  it('prospect-safe has no Expiration and no Deals lens: a link that names one, or a control that asks for one, draws Status', () => {
    for (const lens of ['expiry', 'deals']) {
      const s = parseState(`?safe=1&lens=${lens}&view=stack`, TODAY);
      expect(s, lens).toMatchObject({ safe: true, lens: 'status' });
      expect(serializeState(s, TODAY), lens).toBe('?view=stack&safe=1');
    }
    expect(parseState('?safe=1&lens=rent', TODAY).lens).toBe('rent');
    expect(parseState('?lens=expiry', TODAY).lens).toBe('expiry');
    // Turning the mode on while the Expiration lens is showing falls back too, and it cannot be chosen afterwards.
    const on = applyPatch({ ...d, lens: 'expiry' }, { safe: true }, TODAY);
    expect(on.lens).toBe('status');
    expect(applyPatch(on, { lens: 'expiry' }, TODAY).lens).toBe('status');
    expect(applyPatch(on, { lens: 'deals' }, TODAY).lens).toBe('status');
    expect(applyPatch(on, { lens: 'rent' }, TODAY).lens).toBe('rent');
  });

  it('safeState holds the date only when it is told what today is', () => {
    const on: PlanState = { ...d, safe: true, asOf: '2028-01-01' };
    expect(safeState(on, TODAY).asOf).toBe(TODAY);
    expect(safeState(on)).toBe(on);
    const pinned = safeState(on, TODAY);
    expect(safeState(pinned, TODAY)).toBe(pinned);
  });

  it('safeState and enterSafe leave a state outside the mode untouched, and are idempotent inside it', () => {
    const open: PlanState = { ...d, q: 'cirrus', window: '90', bucket: 1, mode: 'issues' };
    expect(safeState(open)).toBe(open);
    expect(enterSafe(open)).toBe(open);
    const once = enterSafe({ ...open, safe: true });
    expect(enterSafe(once)).toBe(once);
    expect(safeState(once)).toBe(once);
  });

  it('deriveMode never answers worklist or issues for a prospect-safe state, even one built by hand', () => {
    expect(deriveMode({ ...d, safe: true, window: '90' })).toBe('building');
    expect(deriveMode({ ...d, safe: true, mode: 'worklist', window: '90' })).toBe('building');
    expect(deriveMode({ ...d, safe: true, mode: 'issues', select: 'A02' })).toBe('block');
    expect(deriveMode({ ...d, safe: true, mode: 'area' })).toBe('area');
  });
});

describe('deriveMode', () => {
  const d = defaultState(TODAY);
  it('prefers an explicit non-default mode', () => {
    expect(deriveMode({ ...d, mode: 'issues', select: 'L13-U1' })).toBe('issues');
    expect(deriveMode({ ...d, mode: 'area' })).toBe('area');
  });
  it('falls through select, floor, find, worklist, building', () => {
    expect(deriveMode({ ...d, select: 'L13-U1', floor: 'F6', req: 1000, window: '90' })).toBe('block');
    expect(deriveMode({ ...d, floor: 'F6', req: 1000, window: '90' })).toBe('floor');
    expect(deriveMode({ ...d, req: 1000, window: '90' })).toBe('find');
    expect(deriveMode({ ...d, inquiry: 'I02', window: '90' })).toBe('find');
    expect(deriveMode({ ...d, window: '90' })).toBe('worklist');
    expect(deriveMode(d)).toBe('building');
  });
});

describe('skin and theme', () => {
  it('reads the two opt-out skins and ignores anything else', () => {
    expect(parseState('', TODAY).skin).toBeUndefined();
    expect(parseState('?skin=aurora', TODAY).skin).toBe('aurora');
    expect(parseState('?skin=classic', TODAY).skin).toBe('classic');
    expect(parseState('?skin=neon', TODAY).skin).toBeUndefined();
  });
  it('round-trips a skin and omits the default', () => {
    expect(serializeState(defaultState(TODAY), TODAY)).toBe('');
    expect(serializeState({ ...defaultState(TODAY), skin: 'aurora' }, TODAY)).toBe('?skin=aurora');
    expect(parseState('?skin=classic', TODAY)).toEqual({ ...defaultState(TODAY), skin: 'classic' });
  });
  it('the company palette is the default and is dark unless a theme is named', () => {
    const d = defaultState(TODAY);
    expect(paletteOf(d)).toBe('ascendix');
    expect(isDark(d, false)).toBe(true);
    expect(isDark({ ...d, theme: 'light' }, true)).toBe(false);
  });
  it('reads `palette=vice` and ignores anything else', () => {
    expect(parseState('', TODAY).palette).toBeUndefined();
    expect(parseState('?palette=vice', TODAY).palette).toBe('vice');
    expect(parseState('?palette=ascendix', TODAY).palette).toBeUndefined();
    expect(parseState('?palette=neon', TODAY).palette).toBeUndefined();
    expect(paletteOf(parseState('?palette=vice', TODAY))).toBe('vice');
    expect(paletteOf(parseState('?palette=neon', TODAY))).toBe('ascendix');
  });
  it('round-trips the palette and omits the default', () => {
    const d = defaultState(TODAY);
    expect(serializeState({ ...d, ...palettePatch('vice') }, TODAY)).toBe('?palette=vice');
    expect(serializeState({ ...d, palette: 'vice', ...palettePatch('ascendix') }, TODAY)).toBe('');
    expect(parseState('?palette=vice&theme=light', TODAY)).toEqual({ ...d, palette: 'vice', theme: 'light' });
    // A patch is applied like every other change of state.
    expect(applyPatch(d, palettePatch('vice'), TODAY).palette).toBe('vice');
    expect(applyPatch({ ...d, palette: 'vice' }, palettePatch('ascendix'), TODAY).palette).toBeUndefined();
  });
  it('Vice City is dark unless a theme is named, like the default palette', () => {
    expect(isDark({ palette: 'vice', theme: null }, false)).toBe(true);
    expect(isDark({ palette: 'vice', theme: 'light' }, true)).toBe(false);
  });
  it('the opt-out skins have no palette, whatever the URL says', () => {
    expect(paletteOf({ skin: 'aurora' })).toBeNull();
    expect(paletteOf({ skin: 'classic' })).toBeNull();
    expect(paletteOf(parseState('?skin=aurora&palette=vice', TODAY))).toBeNull();
    expect(paletteOf(parseState('?skin=classic&palette=vice', TODAY))).toBeNull();
  });
  it('the other skins follow the operating system', () => {
    expect(isDark({ skin: 'aurora', theme: null }, false)).toBe(false);
    expect(isDark({ skin: 'classic', theme: null }, true)).toBe(true);
    expect(isDark({ skin: 'aurora', theme: 'dark' }, false)).toBe(true);
    expect(isDark({ skin: 'aurora', palette: 'vice', theme: null }, false)).toBe(false);
  });
});
