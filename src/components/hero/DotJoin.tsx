import { Fragment, type ReactNode } from 'react';
import './hero.css';

/**
 * Facts in running text with a "·" between them ("Floor 3 · 74.3% leased · 21,400 RSF"), for a line
 * that may wrap at any width. Each fact stays in one piece, the line breaks between facts only, and
 * where it breaks there is no separator: none ends a line and none begins the next.
 *
 * The separator is a single space, drawn as a dot (hero.css, `.sp-dotjoin__sep`). A space is the one
 * thing a browser drops at a line break, so the dot goes with it; a "·" character would stay behind at
 * the end of the line, or lead the next one. Read as text the facts are separated by that space.
 */
export function DotJoin({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== '' && p !== null && p !== undefined && p !== false);
  return (
    <>
      {shown.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <DotSep />}
          <span className="sp-dotjoin__part">{part}</span>
        </Fragment>
      ))}
    </>
  );
}

/** The separator alone, for a fact that is rendered apart from the run (one that a narrow card leaves out). */
export function DotSep() {
  return <span className="sp-dotjoin__sep"> </span>;
}
