// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { area } from '../../data/mock/area';
import { property } from '../../data/mock/property';
import { BriefDialog } from './BriefDialog';

describe('BriefDialog', () => {
  const html = renderToString(<BriefDialog property={property} area={area} onClose={() => {}} />).replace(/<!-- -->/g, '');

  it('is a dialog named by the brief\'s title, kept off the printed page (the report prints its own)', () => {
    const id = /<dialog[^>]*aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/<dialog[^>]*class="[^"]*sp-no-print/);
  });

  it('has a close button that says so', () => {
    expect(html).toMatch(/<button[^>]*aria-label="Close"/);
  });
});
