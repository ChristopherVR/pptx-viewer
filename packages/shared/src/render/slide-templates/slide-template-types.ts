/**
 * slide-template-types.ts: types for the slide template gallery catalog.
 *
 * A slide template is a pre-designed starter slide (title, agenda, quote, ...)
 * that the New Slide flow can insert. Templates are authored in EMU on the
 * standard 16:9 canvas (12192000 x 6858000 EMU) and scaled to the target
 * deck's pixel canvas at build time, so they fit any slide size.
 */

import type { PptxElement } from 'pptx-viewer-core';

/** Discriminated id for every built-in slide template. */
export type SlideTemplateId =
	| 'title'
	| 'titleAndContent'
	| 'sectionHeader'
	| 'agenda'
	| 'twoContent'
	| 'comparison'
	| 'quote'
	| 'timeline'
	| 'keyMetrics'
	| 'titleOnly'
	| 'blank'
	| 'closing';

/** Catalog entry describing one insertable template for gallery UIs. */
export interface SlideTemplateSpec {
	/** Stable template identifier. */
	id: SlideTemplateId;
	/** i18n key for the display name (e.g. `pptx.slideTemplates.title.name`). */
	nameKey: string;
	/** i18n key for the one-line description shown in the gallery. */
	descriptionKey: string;
}

/**
 * Options for building a template's slide content.
 *
 * `scheme` maps theme colour keys (accent1, tx1, bg1, ...) to resolved hex
 * values; pass the loaded deck's `themeColorMap` so inserted slides inherit
 * the deck look. Missing keys fall back to the Office default scheme.
 */
export interface SlideTemplateBuildOptions {
	/** Target slide width in px (defaults to 1280). */
	slideWidth?: number;
	/** Target slide height in px (defaults to 720). */
	slideHeight?: number;
	/** Theme colour key to resolved hex map (e.g. `PptxData.themeColorMap`). */
	scheme?: Record<string, string>;
	/** Element id factory; index is the element's ordinal within the slide. */
	idFor?: (index: number) => string;
	/**
	 * Translator for the placeholder content written onto template slides
	 * (keys under `pptx.slideTemplates.content.*`). Defaults to the canonical
	 * English dictionary so untranslated hosts still get sensible text.
	 */
	translate?: (key: string) => string;
}

/** The buildable content of a template: elements plus slide-level fills. */
export interface SlideTemplateBuildResult {
	/** Fully positioned elements ready to be placed on a new `PptxSlide`. */
	elements: PptxElement[];
	/** Optional slide background colour (resolved hex). */
	backgroundColor?: string;
}

/**
 * Internal build context handed to every template builder: resolved scheme,
 * px scale factors from the EMU reference canvas, and the id factory.
 */
export interface SlideTemplateBuildContext {
	/** Resolved scheme colour map (never missing the standard keys). */
	scheme: Record<string, string>;
	/** Horizontal scale: px per EMU on the target canvas. */
	scaleX: number;
	/** Vertical scale: px per EMU on the target canvas. */
	scaleY: number;
	/** Mint the next element id. */
	nextId: () => string;
	/** Resolve a `pptx.slideTemplates.content.<suffix>` string. */
	t: (suffix: string) => string;
}

/** A rectangle in EMU on the 12192000 x 6858000 reference canvas. */
export interface EmuFrame {
	x: number;
	y: number;
	w: number;
	h: number;
}
