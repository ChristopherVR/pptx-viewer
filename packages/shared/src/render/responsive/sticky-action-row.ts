/**
 * sticky-action-row.ts: whether a dense panel/dialog's primary action row
 * (OK/Cancel/Apply, Add Row, Send) should stick to the bottom of its
 * scroll container.
 *
 * Options/Print/Share are tall, scrollable dialogs; at 360x640 their content
 * alone can exceed the viewport height, and a non-sticky action row forces a
 * user to scroll all the way down to confirm or dismiss. Making the action
 * row sticky at short/narrow viewports (and leaving it in normal flow on a
 * desktop-height window, matching the desktop dialog's existing look) keeps
 * the primary action reachable without adding a second, competing pattern.
 *
 * @pure
 */
import { isDensePanelCompact } from './dense-panel-viewport';

/** Viewport height (px) below which a dialog's content can plausibly exceed one screen. */
const SHORT_VIEWPORT_MAX_HEIGHT = 700;

/** Whether the panel/dialog's action row should be sticky at this viewport. */
export function shouldStickyActionRow(width: number, height: number): boolean {
	return isDensePanelCompact(width) || height < SHORT_VIEWPORT_MAX_HEIGHT;
}
