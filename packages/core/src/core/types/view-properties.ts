/**
 * View properties types parsed from `ppt/viewProps.xml`.
 *
 * Models the `p:viewPr` element and its child views:
 * normalViewPr, slideViewPr, outlineViewPr, notesTextViewPr,
 * sorterViewPr, notesViewPr.
 *
 * @module pptx-types/view-properties
 */

/**
 * Scale factor for a view (numerator / denominator percentage).
 */
export interface PptxViewScale {
	/** Numerator of the scale percentage (e.g. 100 for 100%). */
	n: number;
	/** Denominator of the scale percentage (e.g. 100 for 100%). */
	d: number;
}

/**
 * Origin point for a view (x, y in twips or EMU).
 */
export interface PptxViewOrigin {
	x: number;
	y: number;
}

/**
 * Restored region dimensions for normal view splitter.
 * Represents `p:restoredLeft` or `p:restoredTop`.
 */
export interface PptxRestoredRegion {
	/** Size as a percentage of the available space (thousandths of a percent). */
	sz: number;
	/** Whether auto-adjust is enabled. */
	autoAdjust?: boolean;
}

/**
 * Normal view properties (`p:normalViewPr`).
 * Controls the splitter positions in normal (editing) view.
 */
export interface PptxNormalViewProperties {
	/** Whether to show outline icons in the slide panel. */
	showOutlineIcons?: boolean;
	/** Whether the outline/slide panel is snapped closed. */
	snapVertSplitter?: boolean;
	/** Vertical splitter bar state: 'minimized' | 'maximized' | 'restored'. */
	vertBarState?: string;
	/** Horizontal splitter bar state. */
	horzBarState?: string;
	/** Whether to prefer single-slide view in the panel. */
	preferSingleView?: boolean;
	/** Restored left region (slide panel width). */
	restoredLeft?: PptxRestoredRegion;
	/** Restored top region (notes panel height). */
	restoredTop?: PptxRestoredRegion;
}

/**
 * Common slide view properties shared by slideViewPr, outlineViewPr,
 * notesTextViewPr, and notesViewPr.
 */
export interface PptxCommonSlideViewProperties {
	/** Whether snap-to-grid is enabled. */
	snapToGrid?: boolean;
	/** Whether snap-to-objects is enabled. */
	snapToObjects?: boolean;
	/** Whether drawing guides are shown. */
	showGuides?: boolean;
	/** View origin (scroll position). */
	origin?: PptxViewOrigin;
	/** View scale. */
	scale?: PptxViewScale;
}

/**
 * Full view properties from `ppt/viewProps.xml`.
 */
export interface PptxViewProperties {
	/** Last used view type (`p:viewPr/@lastView`). */
	lastView?: string;
	/** Whether comments are shown (`p:viewPr/@showComments`). */
	showComments?: boolean;
	/** Normal view properties (splitter positions). */
	normalViewPr?: PptxNormalViewProperties;
	/** Slide view properties. */
	slideViewPr?: PptxCommonSlideViewProperties;
	/** Outline view properties. */
	outlineViewPr?: PptxCommonSlideViewProperties;
	/** Notes text view properties. */
	notesTextViewPr?: PptxCommonSlideViewProperties;
	/** Sorter view scale. */
	sorterViewPr?: { scale?: PptxViewScale };
	/** Notes view properties. */
	notesViewPr?: PptxCommonSlideViewProperties;
	/** Raw XML preserved for lossless round-trip of unparsed attributes. */
	rawXml?: Record<string, unknown>;
}
