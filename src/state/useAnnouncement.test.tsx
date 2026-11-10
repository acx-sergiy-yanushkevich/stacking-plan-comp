import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NO_ANNOUNCEMENT, announce, announcementText, useAnnouncement } from './useAnnouncement';

describe('announcement across the prospect-safe boundary', () => {
  const named = 'Opened Cirrus Energy, Floor 6, suite 600, 21,400 SF.';

  it('reads a message back under the policy it was written under', () => {
    const a = announce(NO_ANNOUNCEMENT(false), named, false);
    expect(announcementText(a, false)).toBe(named);
  });

  it('says nothing the moment prospect-safe turns on, before any effect has run', () => {
    const a = announce(NO_ANNOUNCEMENT(false), named, false);
    expect(announcementText(a, true)).toBe('');
  });

  it('refuses a message composed before the mode changed (a late timer or effect)', () => {
    const safeNow = NO_ANNOUNCEMENT(true);
    expect(announce(safeNow, named, false)).toBe(safeNow);
    expect(announcementText(announce(safeNow, 'Opened Tenant, Floor 6, suite 600, 21,400 SF.', true), true)).toContain('Opened Tenant');
  });

  it('does not bring a withheld message back when the mode is turned off again', () => {
    // The hook resets to an empty message for the new policy; the old text is gone, not parked.
    const afterOn = NO_ANNOUNCEMENT(true);
    const afterOff = NO_ANNOUNCEMENT(false);
    expect(announcementText(afterOn, true)).toBe('');
    expect(announcementText(afterOff, false)).toBe('');
  });

  it('the hook renders an empty live region on first paint in either mode', () => {
    function Probe({ safe }: { safe: boolean }) {
      const [text] = useAnnouncement(safe);
      return <div role="status">{text}</div>;
    }
    expect(renderToString(<Probe safe />)).toBe('<div role="status"></div>');
    expect(renderToString(<Probe safe={false} />)).toBe('<div role="status"></div>');
  });
});
