// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, type FloorView } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import type { LensId } from '../../domain/lenses';
import { floorHeading, floorLabel, floorLabelParts, floorLabelText, floorSentence, labelNote, lensFact, spaceOf } from './floorFact';

const floors = deriveFloors(property, TODAY, TODAY);
const prospect = safeFloors(floors, true);
const floor = (id: string, list: FloorView[] = floors) => list.find((f) => f.floor.id === id)!;
/** What the lens adds to each floor's label. */
const facts = (lens: LensId, safe = false) => Object.fromEntries((safe ? prospect : floors).map((f) => [f.floor.id, lensFact(f, lens, safe)]));
/** Each floor's label as both lists print it. */
const labels = (lens: LensId, safe = false) => Object.fromEntries((safe ? prospect : floors).map((f) => [f.floor.id, floorLabelText(floorLabelParts(f, lens, safe))]));

describe('spaceOf', () => {
  it('says direct space plainly, names a sublease, and splits a floor that has both', () => {
    expect(spaceOf(floor('F12'))).toBe('9,300 SF available');
    expect(spaceOf(floor('F11'))).toBe('');
    // Floor 7 is fully leased and its 7,000 SF is a sublease: "100.0% leased · 7,000 SF available" read as direct space.
    expect(floor('F7').leased).toBe(floor('F7').leasable);
    expect(spaceOf(floor('F7'))).toBe('7,000 SF sublease available');
    // Both on one floor: the total, then its split, in exact SF.
    const f8 = floor('F8');
    const direct = f8.segments.find((sg) => sg.kind === 'available' && !sg.availableFrom)!;
    const both = { available: f8.available, segments: f8.segments.map((sg) => (sg === direct ? { ...sg, kind: 'sublease' as const } : sg)) };
    expect(spaceOf(both)).toBe(`7,400 SF available (${(f8.available - direct.size).toLocaleString('en-US')} direct + ${direct.size.toLocaleString('en-US')} sublease)`);
  });

  it('says the same to a prospect: whether space is direct or a sublease is theirs to know', () => {
    expect(spaceOf(floor('F7', prospect))).toBe('7,000 SF sublease available');
    for (const f of prospect) expect(spaceOf(f)).not.toMatch(/thru|until|expires/i);
  });
});

describe('lensFact', () => {
  it('status: a risk word where one applies', () => {
    const f = facts('status');
    expect(f.F12).toBe('');
    expect(f.F3).toBe('holdover');
    expect(f.F2).toBe('month-to-month');
    expect(f.F6).toBe('expires < 12 mo');
    expect(f.F1).toBe('expires < 12 mo');
    expect(f.F11).toBe('');
  });

  it('expiration: the next expiry within 24 months, or the risk', () => {
    const f = facts('expiry');
    expect(f.F6.replace(/\u00a0/g, ' ')).toBe("expires Mar '27");
    expect(f.F3).toBe('holdover / MTM');
    // Nothing ends within 24 months: no fact (the caption above the model says what a blank means).
    expect(f.F8).toBe('');
    expect(labelNote('expiry', false)).toContain('within 24 months');
    expect(labelNote('expiry', false)).toContain('no date: none in that window');
  });

  it('deals: the count and the furthest stage any deal has reached', () => {
    const f = facts('deals');
    expect(f.F6).toBe('2 live deals · LOI');
    expect(f.F3).toBe('3 live deals · LOI');
    expect(f.F12).toBe('1 live deal · Proposal');
    expect(f.F5).toBe('1 live deal · Tour');
    expect(f.F8).toBe('');
  });

  it('rent: recorded in-place rent as exact ranges, one per lease type and rate unit', () => {
    const f = facts('rent');
    expect(f.F12).toBe('$36/SF/yr FSG');
    expect(f.F3).toBe('$27–$29.75/SF/yr FSG');
    // Gross and modified gross are never one range.
    expect(f.F5).toBe('$30–$31/SF/yr FSG · $26.50/SF/yr MG');
    // Nor a monthly rate with an annual one.
    expect(f.F1).toBe('$42/SF/yr NNN · $3.25/SF/mo NNN');
    for (const text of Object.values(f)) for (const part of text.split(' · ')) expect(part).toMatch(/^(asking )?\$[\d.,]+(–\$[\d.,]+)?\/SF\/(yr|mo) (FSG|MG|NNN)$/);
  });

  it('rent: a confidential lease is left out of the range', () => {
    const secret = property.leases.find((l) => l.confidential && l.rate !== null);
    expect(secret).toBeDefined();
    const f = floors.find((x) => x.segments.some((s) => s.lease?.id === secret!.id))!;
    const others = f.segments.filter((s) => s.lease && !s.lease.confidential && s.lease.rate !== null).map((s) => s.lease!.rate!);
    const text = lensFact(f, 'rent', false);
    if (!others.includes(secret!.rate!)) expect(text).not.toContain(`$${secret!.rate}`);
    expect(text).toBe('$31/SF/yr FSG');
  });

  it('starts in lower case in every lens: it always follows a separator on a label', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const safe of [false, true])
        for (const text of Object.values(facts(lens, safe))) if (text && /^[A-Za-z]/.test(text)) expect(text[0], `${lens}: ${text}`).toBe(text[0].toLowerCase());
  });

  it('prospect-safe: the asking rent of the space on offer, nothing about tenants or deals', () => {
    expect(facts('status', true).F3).toBe('');
    expect(facts('status', true).F2).toBe('');
    expect(facts('expiry', true).F6).toBe('');
    expect(Object.values(facts('deals', true)).every((t) => t === '')).toBe(true);
    const rent = facts('rent', true);
    expect(rent.F12).toBe('asking $38–$40/SF/yr FSG');
    expect(rent.F11).toBe('');
    for (const text of Object.values(rent)) expect(text === '' || text.startsWith('asking ')).toBe(true);
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const) {
      expect(lensFact(floor('F3', prospect), lens, true)).not.toMatch(/holdover|month|expire|deal/i);
      expect(labelNote(lens, true)).not.toMatch(/holdover|month-to-month|deal|in-place|expiry/i);
    }
  });
});

describe('the floor label', () => {
  it('floorLabelParts: the number, the leased share, the space on offer in every lens, then the lens fact', () => {
    expect(floorLabelParts(floor('F12'), 'status', false)).toEqual({ number: '12', leased: '50.0% leased', space: '9,300 SF available', fact: '', largest: false });
    expect(floorLabelParts(floor('F11'), 'status', false)).toEqual({ number: '11', leased: '100.0% leased', space: '', fact: '', largest: false });
    expect(floorLabelParts(floor('F3'), 'status', false)).toMatchObject({ space: '5,500 SF available', fact: 'holdover' });
    expect(floorLabelParts(floor('F7'), 'status', false)).toMatchObject({ leased: '100.0% leased', space: '7,000 SF sublease available' });
    expect(floorLabelParts(floor('F12'), 'status', false, true).largest).toBe(true);
  });

  it('floorLabelText: the one line both floor lists print', () => {
    const l = labels('status');
    expect(l.F12).toBe('12 · 50.0% leased · 9,300 SF available');
    expect(l.F11).toBe('11 · 100.0% leased');
    expect(l.F3).toBe('3 · 74.3% leased · 5,500 SF available · holdover');
    expect(l.F2).toBe('2 · 74.8% leased · month-to-month');
    expect(l.F7).toBe('7 · 100.0% leased · 7,000 SF sublease available');
    expect(floorLabelText(floorLabelParts(floor('F12'), 'status', false, true))).toBe('12 · 50.0% leased · 9,300 SF available Largest block');
    // The space on offer stays in front of what the other lenses add: it is one click away in each of them.
    expect(labels('deals').F12).toBe('12 · 50.0% leased · 9,300 SF available · 1 live deal · Proposal');
    expect(labels('rent').F12).toBe('12 · 50.0% leased · 9,300 SF available · $36/SF/yr FSG');
    // The expiration lens keeps the space too (round 15: the map's list dropped it there).
    expect(labels('expiry').F8).toBe('8 · 65.4% leased · 7,400 SF available');
    expect(labels('expiry').F12.replace(/\u00a0/g, ' ')).toBe("12 · 50.0% leased · 9,300 SF available · expires Jun '28");
    expect(labels('expiry').F6.replace(/\u00a0/g, ' ')).toBe("6 · 100.0% leased · expires Mar '27");
  });

  it('is its accessible name less the word "Floor": the two are built from the same parts', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const f of floors) {
        const p = floorLabelParts(f, lens, false);
        expect([f.floor.name, p.leased, p.space, p.fact].filter(Boolean).join(', ')).toBe(floorLabel(f, lens, false));
        expect(floorLabelText(p)).toBe([p.number, p.leased, p.space, p.fact].filter(Boolean).join(' · '));
      }
  });

  it('prospect-safe: the leased share, the space and its asking rent, nothing about tenants or deals', () => {
    expect(labels('status', true).F3).toBe('3 · 74.3% leased · 5,500 SF available');
    expect(labels('status', true).F2).toBe('2 · 74.8% leased');
    expect(labels('expiry', true).F12).toBe('12 · 50.0% leased · 9,300 SF available');
    expect(labels('rent', true).F12).toBe('12 · 50.0% leased · 9,300 SF available · asking $38–$40/SF/yr FSG');
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const text of Object.values(labels(lens, true))) expect(text, lens).not.toMatch(/holdover|month|expire|deal/i);
  });

  it('labelNote: says what the labels show in each lens, and what the last part is', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const) expect(labelNote(lens, false)).toMatch(/^% leased · space available now · /);
    expect(labelNote('status', false)).toContain('holdover, month-to-month or an expiry within 12 months');
    expect(labelNote('deals', false)).toContain('live deals and the furthest stage');
    expect(labelNote('rent', false)).toContain('in-place rent by lease type (confidential leases left out)');
    expect(labelNote('rent', true)).toBe('% leased · space available now · the asking rent of the space on offer');
    expect(labelNote('status', true)).toBe('% leased · space available now');
  });

  it('floorLabel: the label\'s name says the floor, its leased share, its space and the lens fact', () => {
    expect(floorLabel(floor('F8'), 'status', false)).toBe('Floor 8, 65.4% leased, 7,400 SF available');
    expect(floorLabel(floor('F11'), 'status', false)).toBe('Floor 11, 100.0% leased');
    expect(floorLabel(floor('F12'), 'deals', false)).toBe('Floor 12, 50.0% leased, 9,300 SF available, 1 live deal · Proposal');
    expect(floorLabel(floor('F3', prospect), 'status', true)).toBe('Floor 3, 74.3% leased, 5,500 SF available');
    expect(floorLabel(floor('F7'), 'status', false)).toBe('Floor 7, 100.0% leased, 7,000 SF sublease available');
    // The floor that holds the building's largest block says so, last.
    expect(floorLabel(floor('F12'), 'status', false, true)).toBe('Floor 12, 50.0% leased, 9,300 SF available, largest block');
  });

  it('floorSentence: the full line, saying when a fully leased floor comes to market', () => {
    expect(floorSentence(floor('F8'), TODAY, false)).toBe('21,400 RSF leasable · 65.4% leased · 7,400 SF available');
    expect(floorSentence(floor('F6'), TODAY, false)).toBe("21,400 RSF leasable · 100.0% leased · 21,400 SF marketed from Apr '27");
    expect(floorSentence(floor('F6', prospect), TODAY, true)).toBe('21,400 RSF leasable · 100.0% leased · 0 SF available');
  });

  it('floorHeading: an open floor\'s size and nothing else', () => {
    // The cards under the plate carry the leased share, the available SF and when space comes to market:
    // the heading repeats none of it (round 15: Floor 6 said "marketed from Apr '27" twice).
    expect(floorHeading(floor('F8'))).toBe('21,400 RSF leasable');
    expect(floorHeading(floor('F11'))).toBe('20,800 RSF leasable');
    expect(floorHeading(floor('F6'))).toBe('21,400 RSF leasable');
    expect(floorHeading(floor('F6', prospect))).toBe('21,400 RSF leasable');
    for (const f of floors) expect(floorHeading(f)).toMatch(/^[\d,]+ RSF leasable$/);
  });
});
