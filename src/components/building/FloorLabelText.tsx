import { LARGEST_BLOCK } from '../plan/segmentText';
import type { FloorLabelParts } from './floorFact';
import './floorLabel.css';

/**
 * The text of a floor's label: its number, its leased share, the space on offer and what the lens adds,
 * then the "Largest block" tag. The list beside the Building view's model (FloorLabels) and the Map
 * view's floor list (MapFloorList) both print a floor through this one component, from the same parts
 * (`floorLabelParts`), so the two lists cannot differ in wording, order, capitalisation or type size.
 *
 * It renders four cells of the list's grid (floorLabel.css, `.sp-floorlist`): the numbers stand in a column,
 * the percentages line up on their decimals and the facts begin on one edge. Read as text it is one line:
 * "12 · 50.0% leased · 9,300 SF available Largest block" (`floorLabelText`).
 *
 * The facts are a run of whole parts ("7,400 SF available", "$36/SF/yr FSG"). Where a list is given
 * less width than its longest label (the map's list on a phone) the run breaks between parts only, and
 * a separator neither ends a line nor begins one (base.css, `.sp-dotrun`): a figure stays with its unit
 * and a rate with its lease type.
 */
export function FloorLabelText({ parts }: { parts: FloorLabelParts }) {
  const chunks = [parts.space, ...(parts.fact ? parts.fact.split(' · ') : [])].filter(Boolean);
  return (
    <>
      <span className="sp-flabel__num">{parts.number}</span>
      <span className="sp-flabel__sep">{' · '}</span>
      <span className="sp-flabel__pct">{parts.leased}</span>
      <span className="sp-flabel__fact">
        {chunks.length > 0 && <span className="sp-flabel__sep">{' · '}</span>}
        <span className="sp-dotrun">
          <span className="sp-dotrun__in">
            {chunks.map((chunk, i) => (
              <span key={i} className="sp-dotrun__part">
                {i > 0 && <span className="sp-dotrun__dot">{' · '}</span>}
                {chunk}
              </span>
            ))}
            {/* A space before the tag: read as text, the label is "… 9,300 SF available Largest block", as its name says it. */}
            {parts.largest && ' '}
            {parts.largest && (
              <span className="sp-dotrun__part sp-flabel__tagcell">
                <span className="sp-flabel__tag">{LARGEST_BLOCK}</span>
              </span>
            )}
          </span>
        </span>
      </span>
    </>
  );
}
