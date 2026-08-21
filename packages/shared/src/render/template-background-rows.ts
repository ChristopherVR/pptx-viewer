import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';

/** One editable row in the master/layout background card. */
export interface TemplateBackgroundRow {
	/** The layout or master part path, passed to `setTemplateBackground`/`getTemplateBackgroundColor`. */
	path: string;
	/** Display label (the layout/master's own name, falling back to a generic label). */
	label: string;
	/** Full name/path for a `title` tooltip, when the label is truncated. */
	title: string;
}

/**
 * Resolve which master/layout background rows the active slide's template
 * background card should show: a layout row when the slide has a layout, and
 * a master row when a master references that layout. Both editors
 * (`setTemplateBackground`/`getTemplateBackgroundColor` on `PptxHandler`) key
 * by the returned `path`, which is the layout or master part path.
 *
 * Pure so every binding renders the exact same two rows without re-deriving
 * "which master owns this slide's layout" locally and drifting.
 */
export function resolveTemplateBackgroundRows(
	activeSlide: PptxSlide,
	slideMasters: readonly PptxSlideMaster[] | undefined,
	fallbackLayoutLabel: string,
	fallbackMasterLabel: string,
): { layout?: TemplateBackgroundRow; master?: TemplateBackgroundRow } {
	const result: { layout?: TemplateBackgroundRow; master?: TemplateBackgroundRow } = {};

	if (activeSlide.layoutPath) {
		result.layout = {
			path: activeSlide.layoutPath,
			label: activeSlide.layoutName ?? fallbackLayoutLabel,
			title: activeSlide.layoutName ?? activeSlide.layoutPath,
		};
	}

	const master = slideMasters?.find((m) => m.layoutPaths?.includes(activeSlide.layoutPath ?? ''));
	if (master) {
		result.master = {
			path: master.path,
			label: master.name ?? fallbackMasterLabel,
			title: master.name ?? master.path,
		};
	}

	return result;
}
