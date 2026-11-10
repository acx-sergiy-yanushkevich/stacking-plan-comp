// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors, type FloorView } from '../../domain/derive';
import { safeFloors } from '../../domain/safe';
import type { LensId } from '../../domain/lenses';
import { factNote, floorFact, floorLabel, floorSentence, lensFact } from './floorFact';

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
    // Nothing ends within 24 months: no fact (the note beside the model says what a blank means).
    expect(f.F8).toBe('');
    expect(factNote('expiry', false)).toContain('within 24 months');
    expect(factNote('expiry', false)).toContain('No date means none');
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
      expect(factNote(lens, true)).not.toMatch(/holdover|month-to-month|deal|in-place|expiry/i);
    }
  });

  it('floorLabel: the picker row says the floor, its leased share, its space and the lens fact', () => {
    expect(floorLabel(floor('F8'), 'status', false)).toBe('Floor 8, 65.4% leased, 7,400 SF available');
    expect(floorLabel(floor('F11'), 'status', false)).toBe('Floor 11, 100.0% leased');
    expect(floorLabel(floor('F12'), 'deals', false)).toBe('Floor 12, 50.0% leased, 9,300 SF available, 1 live deal · Proposal');
    expect(floorLabel(floor('F3', prospect), 'status', true)).toBe('Floor 3, 74.3% leased, 5,500 SF available');
  });

  it('floorSentence: the full line, saying when a fully leased floor comes to market', () => {
    expect(floorSentence(floor('F8'), TODAY, false)).toBe('21,400 RSF leasable · 65.4% leased · 7,400 SF available');
    expect(floorSentence(floor('F6'), TODAY, false)).toBe("21,400 RSF leasable · 100.0% leased · 21,400 SF marketed from Apr '27");
    expect(floorSentence(floor('F6', prospect), TODAY, true)).toBe('21,400 RSF leasable · 100.0% leased · 0 SF available');
  });
});
