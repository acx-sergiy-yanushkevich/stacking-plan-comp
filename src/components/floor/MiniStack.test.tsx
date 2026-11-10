// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { MiniStack, miniStackLabel } from './MiniStack';

const floors = deriveFloors(property, TODAY, TODAY);
const render = (props: Partial<Parameters<typeof MiniStack>[0]> = {}) => renderToString(<MiniStack floors={floors} currentId="" onPick={() => {}} {...props} />);
const rows = (html: string) => [...html.matchAll(/<button[^>]*class="sp-mini__row[^>]*>/g)].map((m) => m[0]);

describe('MiniStack', () => {
  it('names each row with the floor, its leased share and its available space, and repeats it as the tooltip', () => {
    const html = render();
    expect(rows(html).length).toBe(property.floors.length);
    expect(html).toContain('aria-label="Floor 8, 65.4% leased, 7,400 SF available"');
    expect(html).toContain('title="Floor 8, 65.4% leased, 7,400 SF available"');
    expect(html).toContain('aria-label="Floor 11, 100.0% leased"');
    expect(miniStackLabel(floors.find((f) => f.floor.id === 'F12')!)).toBe('Floor 12, 50.0% leased, 9,300 SF available');
  });

  it('takes its row names from the caller when a lens has more to say', () => {
    const html = render({ describe: (f) => `${f.floor.name}, expires soon` });
    expect(html).toContain('aria-label="Floor 6, expires soon"');
    expect(html).toContain('title="Floor 6, expires soon"');
  });

  it('is one tab stop: the open floor, or the top floor when none is open', () => {
    const tabbable = (html: string) => rows(html).filter((r) => r.includes('tabindex="0"'));
    expect(tabbable(render()).length).toBe(1);
    expect(tabbable(render())[0]).toContain('data-floor="F12"');
    expect(tabbable(render({ currentId: 'F8' }))[0]).toContain('data-floor="F8"');
  });

  it('marks the open floor as current and a pointed-at floor as lit, never both on one row', () => {
    const html = render({ currentId: 'F8', hotId: 'F3' });
    const current = rows(html).filter((r) => r.includes('aria-current="true"'));
    expect(current.length).toBe(1);
    expect(current[0]).toContain('data-floor="F8"');
    const hot = rows(html).filter((r) => r.includes('is-hot'));
    expect(hot.length).toBe(1);
    expect(hot[0]).toContain('data-floor="F3"');
    expect(hot[0]).not.toContain('aria-current');
    // Pointing at the open floor adds nothing to it.
    expect(rows(render({ currentId: 'F8', hotId: 'F8' })).filter((r) => r.includes('is-hot')).length).toBe(0);
  });
});
