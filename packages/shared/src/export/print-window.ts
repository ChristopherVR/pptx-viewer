/**
 * DOM-touching print-window lifecycle, shared by every binding's raster
 * print path (`window.open`-based; the Svelte binding avoids all of this by
 * printing through a hidden iframe instead and has no need for it).
 *
 * `window.open` is only exempt from popup blocking while it runs as part of
 * the original user-gesture call stack; the instant a caller `await`s
 * anything first (rasterising slides one by one for notes/handouts), the
 * browser no longer considers the call gesture-initiated and silently blocks
 * it -- `window.open` just returns `null`, no error, no console warning. Each
 * binding's raster print path used to build its whole document before ever
 * calling `window.open`, so print silently did nothing the moment that build
 * crossed an `await`.
 *
 * The fix: open the window FIRST, synchronously, with a placeholder page,
 * then write the real document into that same window once it's ready. These
 * two functions are the whole fix; every binding's print handler just calls
 * them at the right points instead of re-implementing this dance itself.
 *
 * `window.open` is called WITHOUT `noopener`: with it, Chrome returns `null`
 * from `window.open` itself even though the tab genuinely opens (confirmed
 * live), so every caller here reads that as "popup blocked", bails out
 * having already left a stray blank tab behind, and never writes the print
 * document into it - the exact "print opens a blank tab and does nothing"
 * report this file exists to prevent. `noopener` protects against a page
 * reaching back into ITS OPENER via `window.opener` (reverse tabnabbing),
 * which only matters for a window opened to a third-party URL; this window
 * is opened blank (`''`) and filled entirely with the app's own
 * document.write() output, so there is no opener relationship worth cutting.
 */
import { escapeHtml } from './html-escape';

/**
 * Open a blank print window right now, synchronously, still inside the
 * click's call stack, with a placeholder page. Returns `null` if the popup
 * was blocked (fully disabled popups, say) -- callers should surface that to
 * the user (e.g. "allow popups for this site to print") rather than silently
 * doing nothing.
 *
 * @param preparingLabel - Host-translated "Preparing to print…" text shown
 *   in the placeholder while the real document is assembled.
 */
export function openPendingPrintWindow(preparingLabel: string): Window | null {
	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		return null;
	}
	const safeLabel = escapeHtml(preparingLabel);
	printWindow.document.open();
	printWindow.document.write(
		`<!doctype html><title>${safeLabel}</title><body style="font:14px system-ui;color:#666;padding:2rem">${safeLabel}</body>`,
	);
	printWindow.document.close();
	return printWindow;
}

/**
 * Write the final print document into an already-open print window (from
 * {@link openPendingPrintWindow}, or opened directly for a path that never
 * awaits anything first), focus it, and trigger the print dialog.
 */
export function finishPrintWindow(printWindow: Window, htmlDocument: string): void {
	printWindow.document.open();
	printWindow.document.write(htmlDocument);
	printWindow.document.close();
	printWindow.focus();
	setTimeout(() => {
		printWindow.print();
	}, 300);
}

/**
 * Open a print window and write a complete document into it in one
 * synchronous call. Only safe for a path that never `await`s before this
 * point (outline; direct SVG slides) -- one that does needs the
 * `openPendingPrintWindow`/`finishPrintWindow` split instead, called before
 * and after its `await`s respectively.
 */
export function openPrintWindow(htmlDocument: string): boolean {
	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		return false;
	}
	finishPrintWindow(printWindow, htmlDocument);
	return true;
}
