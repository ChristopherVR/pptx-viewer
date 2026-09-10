/**
 * dense-panel-sections.ts: how a multi-section dense panel reflows at 360px.
 *
 * Several panels present more than one section side by side on a desktop-wide
 * layout: the Options dialog (nav list + content pane), the chart
 * type/format editor (grouped option cards), the table style editor
 * (gallery + borders/shading controls) and the animation panel (effect list +
 * timing/trigger controls). None of those fit two columns in 360px, so they
 * must stack into one column and, when there are many sections, progressively
 * disclose them (accordion) rather than hiding any control behind a tab that
 * unmounts its content - an unmounted tab would make
 * "the same controls exist at 360px as at 1280px" false, not just
 * differently laid out. Accordion sections stay mounted (collapsed, not
 * removed), so every control is still reachable by an automated a11y query
 * once its section is expanded, exactly like the existing mobile bottom-sheet
 * panels.
 *
 * @pure
 */
import { isDensePanelCompact } from './dense-panel-viewport';

/** How a dense panel's sections are arranged at the current viewport width. */
export type SectionLayoutMode = 'side-by-side' | 'stacked-accordion';

/**
 * `sectionCount` is the number of independently-labelled sections/cards the
 * panel would otherwise show side by side or as separate columns (e.g. the
 * Options dialog's tab list, or the chart editor's option cards). Below three
 * sections, stacking alone (no accordion collapsing) keeps everything
 * reachable without adding an extra expand/collapse step for content that
 * would already fit one screen's worth of scrolling.
 */
export interface SectionLayoutPlan {
	mode: SectionLayoutMode;
	/** Stack sections in a single column instead of N side-by-side columns. */
	stacked: boolean;
	/** Collapse each section to a closed accordion item, expand on demand. */
	collapsible: boolean;
}

const ACCORDION_SECTION_THRESHOLD = 3;

/** Decide how a dense panel with `sectionCount` sections should lay out at `width`. */
export function getSectionLayoutPlan(width: number, sectionCount: number): SectionLayoutPlan {
	const compact = isDensePanelCompact(width);
	if (!compact) {
		return { mode: 'side-by-side', stacked: false, collapsible: false };
	}
	return {
		mode: 'stacked-accordion',
		stacked: true,
		collapsible: sectionCount >= ACCORDION_SECTION_THRESHOLD,
	};
}
