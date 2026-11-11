// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, type FloorView } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import type { LensId } from '../../domain/lenses';
import { nextExpiry } from '../floor/floorData';
import { askingSegments, expirySpan, floorHeading, floorLabel, floorLabelParts, floorLabelText, floorSentence, furthestStage, labelNote, lensDetail, lensFact, spaceOf } from './floorFact';

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

  it('expiration: every floor with a lease says when it expires, however far off; holdover and month-to-month by name', () => {
    const f = Object.fromEntries(Object.entries(facts('expiry')).map(([id, text]) => [id, text.replace(/\u00a0/g, ' ')]));
    // One lease, or several ending in one month: the month.
    expect(f.F6).toBe("expires Mar '27");
    expect(f.F12).toBe("expires Jun '28");
    // Beyond 24 months too (round 16: floors 9, 10 and 11 said nothing, and their colour was the only cue).
    expect(f.F9).toBe("expires May '30");
    expect(f.F10).toBe("expires May '30");
    expect(f.F8).toBe("expires Dec '33");
    expect(f.F4).toBe("expires Mar '31");
    // Leases ending in different months: the first and the last, so a floor of two colours names both terms.
    expect(f.F11).toBe("expires May '30 – Jan '32");
    expect(f.F5).toBe("expires Apr '27 – Sep '28");
    expect(f.F7).toBe("expires Apr '28 – Sep '30");
    expect(f.F1).toBe("expires Feb '27 – May '29");
    // Holdover and month-to-month each by its own name (round 16: both read "holdover / MTM"), and the
    // floor's dated expiry is still given beside them.
    expect(f.F3).toBe("holdover · expires Jun '29");
    expect(f.F2).toBe("month-to-month · expires Dec '31");
    for (const text of Object.values(f)) expect(text).not.toMatch(/MTM|\//);
    // No floor with a lease in place is left without words.
    for (const fl of floors) {
      const hasLease = fl.segments.some((sg) => sg.lease && (sg.kind === 'leased' || sg.kind === 'holdover' || sg.kind === 'mtm' || sg.kind === 'sublease'));
      expect(lensFact(fl, 'expiry', false) !== '', fl.floor.name).toBe(hasLease);
    }
    expect(labelNote('expiry', false)).toBe('% leased · space available now · holdover or month-to-month · lease expiry, first to last');
  });

  it('expiration: the first date is the lease the floor\'s "Next expiry" figure names, the last the one that runs longest', () => {
    for (const fl of floors) {
      const span = expirySpan(fl);
      const dated = fl.segments.filter((sg) => sg.lease && (sg.kind === 'leased' || sg.kind === 'sublease') && sg.endDate && sg.monthsToExpiry !== null && sg.monthsToExpiry >= 0).map((sg) => sg.endDate!);
      if (dated.length === 0) {
        expect(span, fl.floor.name).toBeNull();
        continue;
      }
      expect(span!.first, fl.floor.name).toBe(nextExpiry(fl)!.endDate);
      expect(span!.first).toBe([...dated].sort()[0]);
      expect(span!.last).toBe([...dated].sort().at(-1));
    }
    // A holdover's expired date and a month-to-month lease's missing one are not dates ahead.
    expect(expirySpan(floor('F3'))).toEqual({ first: '2029-06-30', last: '2029-06-30' });
    expect(expirySpan(floor('F2'))).toEqual({ first: '2031-12-31', last: '2031-12-31' });
  });

  it('deals: the count and the furthest stage any deal has reached', () => {
    const f = facts('deals');
    expect(f.F6).toBe('2 live deals · LOI');
    expect(f.F3).toBe('3 live deals · LOI');
    expect(f.F12).toBe('1 live deal · Proposal');
    expect(f.F5).toBe('1 live deal · Tour');
    expect(f.F8).toBe('');
  });

  it('rent: every figure says which rent it is, and a floor with space on offer gives the asking rent of that space', () => {
    const f = facts('rent');
    // Round 16: Floor 12 read "9,300 SF available · $36/SF/yr FSG", a tenant's rent beside space asked at $38–$40.
    expect(f.F12).toBe('asking $38–$40/SF/yr FSG');
    expect(f.F8).toBe('asking $31–$33/SF/yr FSG');
    expect(f.F7).toBe('asking $24–$26/SF/yr FSG');
    expect(f.F3).toBe('asking $30–$32/SF/yr FSG');
    expect(f.F1).toBe('asking $34–$36/SF/yr NNN');
    // No space on offer: the rent in place, as exact ranges, one per lease type and rate unit.
    expect(f.F11).toBe('in place $31/SF/yr FSG');
    expect(f.F2).toBe('in place $28–$31.50/SF/yr FSG');
    // Gross and modified gross are never one range, and each range says it is in place.
    expect(f.F5).toBe('in place $30–$31/SF/yr FSG · in place $26.50/SF/yr MG');
    for (const fl of floors) {
      const text = f[fl.floor.id];
      for (const part of text.split(' · ')) expect(part, fl.floor.name).toMatch(/^(asking|in place) \$[\d.,]+(–\$[\d.,]+)?\/SF\/(yr|mo) (FSG|MG|NNN)$/);
      // Asking where the floor has space with an asking rent, in place otherwise: never the two unmarked, never a bare figure.
      if (text) expect(text.startsWith('asking '), fl.floor.name).toBe(askingSegments(fl, false).length > 0);
    }
  });

  it('rent, in full (the tooltip): the asking rent and the rent in place together, each by name', () => {
    const d = (id: string) => lensDetail(floor(id), 'rent', false);
    expect(d('F12')).toBe('asking $38–$40/SF/yr FSG · in place $36/SF/yr FSG');
    expect(d('F3')).toBe('asking $30–$32/SF/yr FSG · in place $27–$29.75/SF/yr FSG');
    // Nor a monthly rate with an annual one.
    expect(d('F1')).toBe('asking $34–$36/SF/yr NNN · in place $42/SF/yr NNN · in place $3.25/SF/mo NNN');
    expect(d('F11')).toBe('in place $31/SF/yr FSG');
    // In the other lenses it is the label's own fact.
    for (const lens of ['status', 'expiry', 'deals'] as const) for (const fl of floors) expect(lensDetail(fl, lens, false)).toBe(lensFact(fl, lens, false));
    // A prospect is given asking rents only, in the label and in the tooltip alike.
    for (const fl of prospect) {
      expect(lensDetail(fl, 'rent', true)).toBe(lensFact(fl, 'rent', true));
      expect(lensDetail(fl, 'rent', true)).not.toMatch(/in place/);
    }
  });

  it('rent: a confidential lease is left out of the range', () => {
    const secret = property.leases.find((l) => l.confidential && l.rate !== null);
    expect(secret).toBeDefined();
    const f = floors.find((x) => x.segments.some((s) => s.lease?.id === secret!.id))!;
    const others = f.segments.filter((s) => s.lease && !s.lease.confidential && s.lease.rate !== null).map((s) => s.lease!.rate!);
    const text = lensFact(f, 'rent', false);
    if (!others.includes(secret!.rate!)) expect(text).not.toContain(`$${secret!.rate}`);
    expect(text).toBe('in place $31/SF/yr FSG');
    expect(lensDetail(f, 'rent', false)).toBe('in place $31/SF/yr FSG');
  });

  it('deals: furthestStage is the stage the label names, and nothing for a prospect', () => {
    expect(furthestStage(floor('F6'), false)).toBe('LOI');
    expect(furthestStage(floor('F12'), false)).toBe('Proposal');
    expect(furthestStage(floor('F8'), false)).toBeNull();
    for (const fl of prospect) expect(furthestStage(fl, true)).toBeNull();
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
    // A tenant's rent never reaches a prospect: every part is an asking rent, and a floor with no space on offer says nothing.
    for (const fl of prospect) {
      const text = rent[fl.floor.id];
      for (const part of text ? text.split(' · ') : []) expect(part.startsWith('asking '), part).toBe(true);
      expect(text).not.toMatch(/in place/);
      expect(text === '', fl.floor.name).toBe(askingSegments(fl, true).length === 0);
    }
    // The same label a broker reads on a floor with space: the mode changes nothing there.
    for (const id of ['F12', 'F8', 'F7', 'F3', 'F1']) expect(rent[id], id).toBe(facts('rent')[id]);
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
    expect(labels('rent').F12).toBe('12 · 50.0% leased · 9,300 SF available · asking $38–$40/SF/yr FSG');
    expect(labels('rent').F11).toBe('11 · 100.0% leased · in place $31/SF/yr FSG');
    // The expiration lens keeps the space too (round 15: the map's list dropped it there).
    expect(labels('expiry').F8.replace(/\u00a0/g, ' ')).toBe("8 · 65.4% leased · 7,400 SF available · expires Dec '33");
    expect(labels('expiry').F12.replace(/\u00a0/g, ' ')).toBe("12 · 50.0% leased · 9,300 SF available · expires Jun '28");
    expect(labels('expiry').F6.replace(/\u00a0/g, ' ')).toBe("6 · 100.0% leased · expires Mar '27");
    expect(labels('expiry').F11.replace(/\u00a0/g, ' ')).toBe("11 · 100.0% leased · expires May '30 – Jan '32");
    expect(labels('expiry').F3.replace(/\u00a0/g, ' ')).toBe("3 · 74.3% leased · 5,500 SF available · holdover · expires Jun '29");
    expect(labels('expiry').F2.replace(/\u00a0/g, ' ')).toBe("2 · 74.8% leased · month-to-month · expires Dec '31");
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
    expect(labelNote('rent', false)).toBe('% leased · space available now · the asking rent of the space on offer, else the in-place rent (confidential leases left out)');
    expect(labelNote('expiry', false)).toContain('holdover or month-to-month');
    expect(labelNote('expiry', false)).toContain('lease expiry, first to last');
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
