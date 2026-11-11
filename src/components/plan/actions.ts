import type { PlanState } from '../../state/planState';
import { floorOrigin, noteFloorEntry, refocusFloorTrigger, takeReturnMode } from '../../state/focusStore';

export type Patch = (p: Partial<PlanState>) => void;

/**
 * Navigation helpers shared by every view so selection and drill-in behave the same
 * everywhere. `deriveMode` (state/planState.ts) turns these fields into the inspector mode.
 */

/** Select a block: inspector shows its detail; active filters (find, worklist, search) stay on. */
export const selectSegment = (patch: Patch, key: string) => patch({ select: key, floor: null, mode: 'building' });

/** Clear the selection: inspector falls back to the active filter panel or Building, or to the tool panel that located the block. */
export const clearSelection = (patch: Patch) => {
  const back = takeReturnMode();
  patch(back ? { select: null, floor: null, mode: back } : { select: null, floor: null });
};

/** Show a floor's summary in the inspector (from the floor label or a map floor). */
export const openFloor = (patch: Patch, floorId: string) => patch({ floor: floorId, select: null, mode: 'building' });

/**
 * Drill into the floor plate view. The entry is noted first (`focusStore`), so the Floor view can take
 * keyboard focus on its heading when it opens and Back can return to where the user was.
 */
export const openFloorPlate = (patch: Patch, floorId: string) => {
  noteFloorEntry();
  patch({ view: 'floor', floor: floorId, select: null, mode: 'building' });
};

/**
 * Back from the floor plate to the view it was opened from (Building or Stack; Stack when it was
 * opened by a link), keeping the floor open there, and return focus to the control that opened it.
 */
export const backFromFloor = (patch: Patch, floorId: string | null) => {
  patch({ view: floorOrigin() });
  if (floorId) refocusFloorTrigger(floorId);
};

/** The state each tool panel's Close (and Escape) writes: the panel goes, and so do the filters it set. */
export const TOOL_CLOSE = {
  find: { mode: 'building', req: null, max: null, by: null, inquiry: null },
  worklist: { mode: 'building', window: null },
  issues: { mode: 'building' },
  area: { mode: 'building' },
} as const satisfies Record<string, Partial<PlanState>>;

export type ToolPanel = keyof typeof TOOL_CLOSE;
export const isToolPanel = (mode: string): mode is ToolPanel => mode in TOOL_CLOSE;

/**
 * The floor a tool panel (Area, Find space, Worklist) leaves open. The Floor view is that floor, and the
 * Building view docks it beside the model: both keep it, so the panel opens beside it and closing the
 * panel brings the floor back (round 18: the Floor view jumped to Floor 12 and opened nothing).
 */
export const floorKept = (view: string, floor: string | null): string | null => (view === 'floor' || view === 'building' ? floor : null);

/**
 * Open the Area panel (demographics, transit and amenities around the building), from the toolbar in any
 * view or from the Building panel's preview. It is a tool panel: a selection and the finder's and
 * worklist's filters close.
 */
export const openArea = (patch: Patch, floor: string | null = null) => patch({ mode: 'area', select: null, floor, req: null, max: null, by: null, inquiry: null, window: null });

/** Toggle a rollover bucket filter (0 = next 12 months). */
export const toggleBucket = (patch: Patch, current: number | null, key: number) => patch({ bucket: current === key ? null : key, select: null });

/** Record actions that would call Salesforce; the prototype shows a toast. */
export type RecordAction = 'open-lease' | 'open-availability' | 'open-deal' | 'open-inquiry' | 'open-account' | 'new-deal' | 'log-call' | 'new-availability' | 'start-renewal' | 'add-unit' | 'assign-floor' | 'verify' | 'fix-availability' | 'review-floor' | 'mark-reviewed' | 'create-listing';

export const RECORD_ACTION_LABEL: Record<RecordAction, string> = {
  'open-lease': 'Open lease',
  'open-availability': 'Open availability',
  'open-deal': 'Open deal',
  'open-inquiry': 'Open inquiry',
  'open-account': 'Open account',
  'new-deal': 'New deal',
  'log-call': 'Log a call',
  'new-availability': 'Create availability',
  'start-renewal': 'Start renewal',
  'add-unit': 'Add unit',
  'assign-floor': 'Assign floor',
  verify: 'Mark verified',
  'fix-availability': 'Fix availability',
  'review-floor': 'Review floor',
  'mark-reviewed': 'Mark reviewed',
  'create-listing': 'Create listing',
};

/** Text for the toast stub describing what Salesforce would do. */
export function recordActionToast(action: RecordAction, recordLabel: string): string {
  switch (action) {
    case 'new-deal':
      return `Would open New Deal (Landlord Representation) pre-filled with ${recordLabel}`;
    case 'log-call':
      return `Would open Log a Call on ${recordLabel}`;
    case 'new-availability':
      return `Would open New Availability pre-filled for ${recordLabel}`;
    case 'start-renewal':
      return `Would create a Renewal deal from ${recordLabel}`;
    case 'add-unit':
      return `Would open New Unit under ${recordLabel}`;
    case 'assign-floor':
      return `Would open ${recordLabel} to set its Floor`;
    case 'verify':
      return `Would stamp ${recordLabel} as verified today`;
    case 'fix-availability':
      return `Would open ${recordLabel} to correct its flags`;
    case 'review-floor':
      return `Would open ${recordLabel} with its units and availabilities`;
    case 'create-listing':
      return `Would create a Listing from ${recordLabel} and publish it to the marketing feed`;
    case 'mark-reviewed':
      return `Would mark the issue on ${recordLabel} as reviewed and hide it until the record changes`;
    default:
      return `Would open ${recordLabel} in Salesforce`;
  }
}
