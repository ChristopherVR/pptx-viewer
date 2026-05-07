/**
 * Master and layout types: notes master, handout master, slide master,
 * slide layout, and theme options.
 *
 * @module pptx-types/masters
 */

// ==========================================================================
// Notes Master, Handout Master, Slide Master & Layout types
// ==========================================================================

import type { PlaceholderTextLevelStyle } from './element-base';
import type { PptxElement } from './elements';

/**
 * Parsed notes master from `ppt/notesMasters/notesMaster1.xml`.
 *
 * @example
 * ```ts
 * const notes: PptxNotesMaster = {
 *   path: "ppt/notesMasters/notesMaster1.xml",
 *   backgroundColor: "#FFFFFF",
 *   placeholders: [{ type: "body" }, { type: "sldImg" }],
 * };
 * // => satisfies PptxNotesMaster
 * ```
 */
export interface PptxNotesMaster {
	/** File path within the PPTX archive. */
	path: string;
	/** Background colour of the notes master. */
	backgroundColor?: string;
	/** Background image data URL. */
	backgroundImage?: string;
	/** Placeholder shapes found on the notes master. */
	placeholders?: Array<{
		type: string;
		idx?: string;
	}>;
	/** Editable elements on the notes master (header, footer, date, page number, slide image, notes body). */
	elements?: PptxElement[];
	/** Header/footer flags from `<p:hf>` on the notes master (P-H3). */
	headerFooter?: PptxHeaderFooterFlags;
	/** Colour map from `<p:clrMap>` (12 alias attributes). Applied at save time. */
	clrMap?: Record<string, string>;
}

/**
 * Parsed handout master from `ppt/handoutMasters/handoutMaster1.xml`.
 *
 * @example
 * ```ts
 * const handout: PptxHandoutMaster = {
 *   path: "ppt/handoutMasters/handoutMaster1.xml",
 *   slidesPerPage: 6,
 * };
 * // => satisfies PptxHandoutMaster
 * ```
 */
export interface PptxHandoutMaster {
	/** File path within the PPTX archive. */
	path: string;
	/** Background colour of the handout master. */
	backgroundColor?: string;
	/** Background image data URL. */
	backgroundImage?: string;
	/** Placeholder shapes found on the handout master. */
	placeholders?: Array<{
		type: string;
		idx?: string;
	}>;
	/** Editable elements on the handout master (header, footer, date, page number, slide placeholders). */
	elements?: PptxElement[];
	/** Number of slides per page for handout print layout (1, 2, 3, 4, 6, or 9). */
	slidesPerPage?: number;
	/** Header/footer flags from `<p:hf>` on the handout master (P-H3). */
	headerFooter?: PptxHeaderFooterFlags;
	/** Colour map from `<p:clrMap>` (12 alias attributes). Applied at save time. */
	clrMap?: Record<string, string>;
}

/**
 * Active tab within the master view sidebar.
 *
 * @example
 * ```ts
 * const tab: MasterViewTab = "slides";
 * // => "slides" — one of: "slides" | "notes" | "handout"
 * ```
 */
export type MasterViewTab = 'slides' | 'notes' | 'handout';

// ==========================================================================
// Slide Master typed export (GAP-10)
// ==========================================================================

/**
 * Structured slide master data.
 *
 * @example
 * ```ts
 * const master: PptxSlideMaster = {
 *   path: "ppt/slideMasters/slideMaster1.xml",
 *   name: "Office Theme",
 *   backgroundColor: "#FFFFFF",
 *   themePath: "ppt/theme/theme1.xml",
 * };
 * // => satisfies PptxSlideMaster
 * ```
 */
export interface PptxSlideMaster {
	/** File path within the PPTX archive. */
	path: string;
	/** Human-readable name if available. */
	name?: string;
	/** Background colour of the slide master. */
	backgroundColor?: string;
	/** Background image data URL for the slide master. */
	backgroundImage?: string;
	/** Theme file path this master references. */
	themePath?: string;
	/** Layout paths associated with this master. */
	layoutPaths?: string[];
	/** Placeholder shapes on the master. */
	placeholders?: Array<{
		type: string;
		idx?: string;
	}>;
	/** Parsed element shapes on the master slide (for master view rendering). */
	elements?: PptxElement[];
	/** Parsed slide layout objects associated with this master. */
	layouts?: PptxSlideLayout[];
	/** Text styles from `p:txStyles` — title, body, and other text defaults. */
	txStyles?: PptxMasterTextStyles;
	/** Header/footer flags from `<p:hf>` on this master (P-H3). */
	headerFooter?: PptxHeaderFooterFlags;
	/**
	 * Colour map from `<p:clrMap>` (12 alias attributes: bg1/tx1/bg2/tx2,
	 * accent1-6, hlink, folHlink). Applied at save time when present.
	 */
	clrMap?: Record<string, string>;
}

/**
 * Per-level paragraph properties for a text style category.
 * Each entry maps a 0-based level index to its style defaults.
 */
export type PptxTextStyleLevels = Record<number, PlaceholderTextLevelStyle>;

/**
 * Text styles parsed from `p:txStyles` on a slide master.
 * Provides cascading defaults for title, body, and other text.
 */
export interface PptxMasterTextStyles {
	/** Title text style (`p:titleStyle`). */
	titleStyle?: PptxTextStyleLevels;
	/** Body text style (`p:bodyStyle`). */
	bodyStyle?: PptxTextStyleLevels;
	/** Other text style (`p:otherStyle`). */
	otherStyle?: PptxTextStyleLevels;
}

/**
 * Per-part header/footer flags from `<p:hf>` (CT_HeaderFooter, ECMA-376
 * §19.3.1.21). Defaults are "all true" — fields are only set on the typed
 * model when they were explicitly read, so callers can distinguish "unset"
 * (preserve original XML) from "false" (override).
 */
export interface PptxHeaderFooterFlags {
	/** `@hdr` — show header placeholder. Spec default: `true`. */
	hasHeader?: boolean;
	/** `@ftr` — show footer placeholder. Spec default: `true`. */
	hasFooter?: boolean;
	/** `@dt` — show date/time placeholder. Spec default: `true`. */
	hasDateTime?: boolean;
	/** `@sldNum` — show slide-number placeholder. Spec default: `true`. */
	hasSlideNumber?: boolean;
}

/**
 * A slide layout associated with a slide master.
 *
 * @example
 * ```ts
 * const layout: PptxSlideLayout = {
 *   path: "ppt/slideLayouts/slideLayout2.xml",
 *   name: "Title and Content",
 * };
 * // => satisfies PptxSlideLayout
 * ```
 */
export interface PptxSlideLayout {
	/** File path within the PPTX archive. */
	path: string;
	/** Human-readable layout name. */
	name?: string;
	/** Background colour of the layout. */
	backgroundColor?: string;
	/** Background image data URL for the layout. */
	backgroundImage?: string;
	/** Parsed element shapes on the layout. */
	elements?: PptxElement[];
	/** Placeholder shapes on the layout. */
	placeholders?: Array<{
		type: string;
		idx?: string;
	}>;
	/** Matching name attribute for layout identification (`@matchingName`). */
	matchingName?: string;
	/** Whether the layout is marked as preserved (prevent deletion, `@preserve`). */
	preserve?: boolean;
	/** Whether master placeholder animations should play (`@showMasterPhAnim`). */
	showMasterPhAnim?: boolean;
	/** Whether this layout is user-drawn (`@userDrawn`). */
	userDrawn?: boolean;
	/** Colour map override from `p:clrMapOvr`. */
	clrMapOverride?: Record<string, string>;
	/** Header/footer flags from `<p:hf>` on this layout (P-H3). */
	headerFooter?: PptxHeaderFooterFlags;
}

/**
 * A theme part available in the presentation package.
 *
 * @example
 * ```ts
 * const opt: PptxThemeOption = {
 *   path: "ppt/theme/theme1.xml",
 *   name: "Office Theme",
 * };
 * // => satisfies PptxThemeOption
 * ```
 */
export interface PptxThemeOption {
	/** File path within the PPTX archive (e.g. `ppt/theme/theme2.xml`). */
	path: string;
	/** Human-readable theme name from `a:theme/@name`, when present. */
	name?: string;
}
