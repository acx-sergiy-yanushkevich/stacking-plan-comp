import { useCallback, useState } from 'react';

/**
 * A live-region message together with the disclosure policy it was written under. The text is only
 * ever read back under that same policy, so a sentence composed for the broker ("Opened Cirrus
 * Energy…") cannot outlive the moment prospect-safe is turned on.
 */
export interface Announcement {
  text: string;
  safe: boolean;
}

export const NO_ANNOUNCEMENT = (safe: boolean): Announcement => ({ text: '', safe });

/** What the live region may say under the current policy: the text, or nothing if it was written under the other one. */
export const announcementText = (a: Announcement, safe: boolean): string => (a.safe === safe ? a.text : '');

/**
 * A new message, accepted only from a caller that composed it under the policy now in force. A timer
 * or effect that started before the mode changed is refused, not shown.
 */
export const announce = (a: Announcement, text: string, writtenUnderSafe: boolean): Announcement => (a.safe === writtenUnderSafe ? { ...a, text } : a);

/**
 * `useState('')` for a polite live region, with the prospect-safe boundary built in. The message is
 * dropped in the same render in which `safe` changes (state is adjusted during render, before
 * anything is committed to the DOM), so no frame and no screen-reader announcement carries the old
 * text. Turning the mode off again does not bring a withheld message back.
 *
 *   const [announce, setAnnounce] = useAnnouncement(state.safe);
 */
export function useAnnouncement(safe: boolean): [string, (text: string) => void] {
  const [said, setSaid] = useState<Announcement>(() => NO_ANNOUNCEMENT(safe));
  if (said.safe !== safe) setSaid(NO_ANNOUNCEMENT(safe));
  const say = useCallback((text: string) => setSaid((a) => announce(a, text, safe)), [safe]);
  return [announcementText(said, safe), say];
}
