import { createSignal } from '../../lib/signal';

/**
 * "Record video" in the header's Export menu, heard by the Map view's recorder (which starts, or stops a
 * recording under way). A module of its own, so the header does not load the map to send it.
 */
export const RECORD_REQUEST = createSignal();
