import { describe, expect, it } from 'vitest';
import { contactLabel, prospectLabel, rentVisible, SAFE_TITLE, tenantLabel, TITLE } from './safe';

describe('prospect-safe helpers', () => {
  it('replaces the tenant name in safe mode', () => {
    expect(tenantLabel({ tenant: 'Cirrus Energy' }, false)).toBe('Cirrus Energy');
    expect(tenantLabel({ tenant: 'Cirrus Energy' }, true)).toBe('Tenant');
  });
  it('drops the contact in safe mode', () => {
    expect(contactLabel('Tom Conner', false)).toBe('Tom Conner');
    expect(contactLabel('Tom Conner', true)).toBeUndefined();
    expect(contactLabel(undefined, false)).toBeUndefined();
  });
  it('replaces the prospect name in safe mode', () => {
    expect(prospectLabel({ prospect: 'Vantage Robotics' }, false)).toBe('Vantage Robotics');
    expect(prospectLabel({ prospect: 'Vantage Robotics' }, true)).toBe('Prospect');
  });
  it('hides rent when safe or confidential', () => {
    expect(rentVisible({ confidential: false }, false)).toBe(true);
    expect(rentVisible({}, false)).toBe(true);
    expect(rentVisible({ confidential: true }, false)).toBe(false);
    expect(rentVisible({ confidential: false }, true)).toBe(false);
    expect(rentVisible({ confidential: true }, true)).toBe(false);
  });
  it('has distinct titles', () => {
    expect(TITLE).toBe('Stacking plan');
    expect(SAFE_TITLE).toBe('Stacking plan (prospect-safe)');
  });
});
