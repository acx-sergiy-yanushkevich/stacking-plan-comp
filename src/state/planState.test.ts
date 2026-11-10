import { describe, expect, it } from 'vitest';
import { TODAY } from '../data/mock/property';
import { DEFAULT_STATE, defaultState, deriveMode, isDark, isVice, parseState, serializeState, type PlanState } from './planState';

describe('parseState', () => {
  it('reads every supported field', () => {
    const s = parseState('?lens=expiry&asOf=2028-01-01&safe=1&req=12000&window=12&view=timeline', TODAY);
    expect(s.lens).toBe('expiry');
    expect(s.asOf).toBe('2028-01-01');
    expect(s.safe).toBe(true);
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
      safe: true,
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
  it('the Vice City palette is the default and is dark unless a theme is named', () => {
    const d = defaultState(TODAY);
    expect(isVice(d)).toBe(true);
    expect(isVice({ skin: 'aurora' })).toBe(false);
    expect(isDark(d, false)).toBe(true);
    expect(isDark({ ...d, theme: 'light' }, true)).toBe(false);
  });
  it('the other skins follow the operating system', () => {
    expect(isDark({ skin: 'aurora', theme: null }, false)).toBe(false);
    expect(isDark({ skin: 'classic', theme: null }, true)).toBe(true);
    expect(isDark({ skin: 'aurora', theme: 'dark' }, false)).toBe(true);
  });
});
