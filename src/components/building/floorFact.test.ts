// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, type FloorView } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import type { LensId } from '../../domain/lenses';
import { floorFact, floorHeading, floorLabel, floorParts, floorSentence, labelNote, lensFact } from './floorFact';

const floors = deriveFloors(property, TODAY, TODAY);
const prospect = safeFloors(floors, true);
const floor = (id: string, list: FloorView[] = floors) => list.find((f) => f.floor.id === id)!;
const facts = (lens: LensId, safe = false) => Object.fromEntries((safe ? prospect : floors).map((f) => [f.floor.id, floorFact(f, lens, safe)]));

describe('floorFact', () => {
  it('status: space on offer, then a risk word where one applies', () => {
    const f = facts('status');
    expect(f.F12).toBe('9,300 SF available');
    expect(f.F3).toBe('5,500 SF available · holdover');
    expect(f.F2).toBe('Month-to-month');
    expect(f.F6).toBe('Expires < 12 mo');
    expect(f.F1).toBe('4,000 SF available · expires < 12 mo');
    expect(f.F11).toBe('');
  });

  it('expiration: the next expiry within 24 months, or the risk', () => {
    const f = facts('expiry');
    expect(f.F6).toBe("Expires Mar '27");
    expect(f.F3).toBe('Holdover / MTM');
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
    for (const text of Object.values(f)) for (const part of text.split(' · ')) expect(part).toMatch(/^(Asking )?\$[\d.,]+(–\$[\d.,]+)?\/SF\/(yr|mo) (FSG|MG|NNN)$/);
  });

  it('rent: a confidential lease is left out of the range', () => {
    const secret = property.leases.find((l) => l.confidential && l.rate !== null);
    expect(secret).toBeDefined();
    const f = floors.find((x) => x.segments.some((s) => s.lease?.id === secret!.id))!;
    const others = f.segments.filter((s) => s.lease && !s.lease.confidential && s.lease.rate !== null).map((s) => s.lease!.rate!);
    const text = floorFact(f, 'rent', false);
    if (!others.includes(secret!.rate!)) expect(text).not.toContain(`$${secret!.rate}`);
    expect(text).toBe('$31/SF/yr FSG');
  });

  it('prospect-safe: space on offer and its asking rent, nothing about tenants or deals', () => {
    expect(facts('status', true).F3).toBe('5,500 SF available');
    expect(facts('status', true).F2).toBe('');
    expect(facts('expiry', true).F6).toBe('');
    expect(facts('expiry', true).F12).toBe('9,300 SF available');
    expect(Object.values(facts('deals', true)).every((t) => t === '')).toBe(true);
    const rent = facts('rent', true);
    expect(rent.F12).toBe('Asking $38–$40/SF/yr FSG');
    expect(rent.F11).toBe('');
    for (const text of Object.values(rent)) expect(text === '' || text.startsWith('Asking ')).toBe(true);
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const) {
      expect(lensFact(floor('F3', prospect), lens, true)).not.toMatch(/holdover|month|expire|deal/i);
      expect(labelNote(lens, true)).not.toMatch(/holdover|month-to-month|deal|in-place|expiry/i);
    }
  });

  it('floorParts: a label prints the leased share, then the space on offer in every lens, then the lens fact', () => {
    expect(floorParts(floor('F12'), 'status', false)).toEqual({ leased: '50.0% leased', fact: '9,300 SF available' });
    expect(floorParts(floor('F11'), 'status', false)).toEqual({ leased: '100.0% leased', fact: '' });
    expect(floorParts(floor('F3'), 'status', false).fact).toBe('5,500 SF available · holdover');
    expect(floorParts(floor('F2'), 'status', false).fact).toBe('month-to-month');
    // The space on offer stays in front of what the other lenses add: it is one click away in each of them.
    expect(floorParts(floor('F12'), 'deals', false).fact).toBe('9,300 SF available · 1 live deal · Proposal');
    expect(floorParts(floor('F12'), 'rent', false).fact).toBe('9,300 SF available · $36/SF/yr FSG');
    expect(floorParts(floor('F6'), 'expiry', false).fact.replace(/\u00a0/g, ' ')).toBe("Expires Mar '27");
    // Every label is its accessible name less the word "Floor": the two are built from the same parts.
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const f of floors) {
        const { leased, fact } = floorParts(f, lens, false);
        expect([f.floor.name, leased, ...(fact ? [fact] : [])].join(', ').replace(' available · ', ' available, ')).toBe(floorLabel(f, lens, false));
      }
  });

  it('floorParts, prospect-safe: the leased share, the space and its asking rent, nothing about tenants or deals', () => {
    expect(floorParts(floor('F3', prospect), 'status', true)).toEqual({ leased: '74.3% leased', fact: '5,500 SF available' });
    expect(floorParts(floor('F2', prospect), 'status', true).fact).toBe('');
    expect(floorParts(floor('F12', prospect), 'rent', true).fact).toBe('9,300 SF available · Asking $38–$40/SF/yr FSG');
    for (const lens of ['status', 'expiry', 'deals', 'rent'] as const)
      for (const f of prospect) expect(floorParts(f, lens, true).fact, `${f.floor.name}, ${lens}`).not.toMatch(/holdover|month|expire|deal/i);
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
    // The floor that holds the building's largest block says so, last.
    expect(floorLabel(floor('F12'), 'status', false, true)).toBe('Floor 12, 50.0% leased, 9,300 SF available, largest block');
  });

  it('floorSentence: the full line, saying when a fully leased floor comes to market', () => {
    expect(floorSentence(floor('F8'), TODAY, false)).toBe('21,400 RSF leasable · 65.4% leased · 7,400 SF available');
    expect(floorSentence(floor('F6'), TODAY, false)).toBe("21,400 RSF leasable · 100.0% leased · 21,400 SF marketed from Apr '27");
    expect(floorSentence(floor('F6', prospect), TODAY, true)).toBe('21,400 RSF leasable · 100.0% leased · 0 SF available');
  });

  it('floorHeading: an open floor\'s size, and when it comes to market if nothing is free today', () => {
    // The cards under the plate carry the leased share and the available SF: the heading does not repeat them.
    expect(floorHeading(floor('F8'), TODAY, false)).toBe('21,400 RSF leasable');
    expect(floorHeading(floor('F11'), TODAY, false)).toBe('20,800 RSF leasable');
    expect(floorHeading(floor('F6'), TODAY, false).replace(/\u00a0/g, ' ')).toBe("21,400 RSF leasable · 21,400 SF marketed from Apr '27");
    // The listing is quiet: a prospect is told the size only.
    expect(floorHeading(floor('F6', prospect), TODAY, true)).toBe('21,400 RSF leasable');
    for (const f of floors) expect(floorHeading(f, TODAY, false)).not.toMatch(/% leased|SF available/);
  });
});
