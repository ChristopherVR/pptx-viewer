/**
 * dense-panel-viewport.ts: the single breakpoint every dense-panel responsive
 * decision function is measured against.
 *
 * "Dense" panels (chart data/format editors, table data/style editors, the
 * animation panel, inspector sub-panels, the AI panel, comments, and the
 * options/print/share dialogs) pack far more controls than the ribbon or the
 * mobile bottom bar. They already reach a phone through the existing
 * `isMobileViewport` chrome switch (bottom sheet vs side panel), but their
 * OWN internal layout - how many columns, whether sections tab/accordion,
 * whether the action row is sticky - needs a decision too. That decision
 * reuses `MOBILE_BREAKPOINT` from `mobile-viewport.ts` rather than inventing a
 * second threshold: two breakpoints that drift apart is exactly the kind of
 * divergence CLAUDE.md's Rule 2 exists to prevent.
 *
 * @pure: no DOM/window access. Callers pass `window.innerWidth`/`innerHeight`
 * (never a container box - see `mobile-viewport.ts` for why).
 */
import { MOBILE_BREAKPOINT } from '../mobile-viewport';

/** Whether a dense panel must use its compact (single-column, stacked) layout. */
export function isDensePanelCompact(width: number): boolean {
	return width < MOBILE_BREAKPOINT;
}
