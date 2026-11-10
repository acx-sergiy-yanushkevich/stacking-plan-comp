import { describe, expect, it } from 'vitest';
import { nextToasts, type ToastItem } from './Toast';

const toast = (id: number, message: string): ToastItem => ({ id, message });

describe('toasts and the prospect-safe boundary', () => {
  it('keeps the three most recent toasts', () => {
    let items: ToastItem[] = [];
    for (let i = 1; i <= 4; i++) items = nextToasts(items, toast(i, `Toast ${i}`), { withheld: false });
    expect(items.map((t) => t.id)).toEqual([2, 3, 4]);
  });

  it('refuses a toast that names a record while toasts are withheld', () => {
    const items = [toast(1, 'Link to this view copied')];
    const named = toast(2, 'Would open Deal D8 (Vantage Robotics) in Salesforce');
    expect(nextToasts(items, named, { named: true, withheld: true })).toBe(items);
    expect(nextToasts(items, named, { named: true, withheld: false })).toContain(named);
  });

  it('still shows a toast that names nothing while withheld', () => {
    const plain = toast(2, 'Rent roll exported (prospect-safe)');
    expect(nextToasts([], plain, { withheld: true })).toEqual([plain]);
  });
});
