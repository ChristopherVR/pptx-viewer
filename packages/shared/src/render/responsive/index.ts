/**
 * Dense-panel responsive layout: pure decision functions shared by every
 * binding for how the data-dense panels (chart/table editors, animation
 * panel, inspector sub-panels, AI panel, comments, options/print/share
 * dialogs) reflow at narrow widths (as narrow as 360px) instead of merely
 * relying on the mobile-chrome bottom-sheet switch that already happens at
 * `MOBILE_BREAKPOINT`. See each module's own doc comment for the specific
 * problem it solves.
 */
export { isDensePanelCompact } from './dense-panel-viewport';
export {
	MIN_TOUCH_TARGET_PX,
	DEFAULT_DENSE_BUTTON_PX,
	getDensePanelTouchTargetPx,
	getDensePanelTouchTargetBox,
} from './touch-target';
export type { TouchTargetBoxSize } from './touch-target';
export { getSectionLayoutPlan } from './dense-panel-sections';
export type { SectionLayoutMode, SectionLayoutPlan } from './dense-panel-sections';
export { getDenseGridLayoutPlan } from './dense-grid-layout';
export type { DenseGridLayoutPlan } from './dense-grid-layout';
export { shouldStickyActionRow } from './sticky-action-row';
