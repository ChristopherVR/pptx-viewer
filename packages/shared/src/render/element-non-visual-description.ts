/**
 * Which element kinds model an accessibility description (`altText`) and
 * title (`title`) on `p:cNvPr` (`@descr` / `@title`, `PptxNonVisualDescription`
 * in core), and a pure descriptor every binding's inspector can use to decide
 * whether to show the alt-text / title editing fields for the selected
 * element.
 *
 * Before this module existed, a picture's own alt-text field was the only
 * one any binding's inspector rendered; a plain shape, text box or connector
 * had nowhere to author the same PowerPoint Accessibility-pane text even
 * after core started parsing it. Centralising the "which element kinds get
 * which field" decision here means a new kind reaches every binding's
 * inspector by editing one set, not five.
 *
 * @module render/element-non-visual-description
 */

import type { PptxElement } from 'pptx-viewer-core';

/** Element kinds whose core type models `altText` (`p:cNvPr/@descr`). */
const ALT_TEXT_ELEMENT_TYPES: ReadonlySet<PptxElement['type']> = new Set<PptxElement['type']>([
	'image',
	'picture',
	'table',
	'chart',
	'smartArt',
	'ole',
	'media',
	'text',
	'shape',
	'connector',
]);

/**
 * Element kinds whose core type models `title` (`p:cNvPr/@title`). A picture
 * is deliberately excluded: `ImagePptxElement`/`PicturePptxElement` only ever
 * carry `altText` (no `title` field), matching how PowerPoint's own Alt Text
 * pane has no separate title box for a picture.
 */
const TITLE_ELEMENT_TYPES: ReadonlySet<PptxElement['type']> = new Set<PptxElement['type']>([
	'table',
	'chart',
	'smartArt',
	'ole',
	'media',
	'text',
	'shape',
	'connector',
]);

/** Whether `type`'s core element models an `altText` field. */
export function supportsAltTextField(type: PptxElement['type']): boolean {
	return ALT_TEXT_ELEMENT_TYPES.has(type);
}

/** Whether `type`'s core element models a `title` field. */
export function supportsTitleField(type: PptxElement['type']): boolean {
	return TITLE_ELEMENT_TYPES.has(type);
}

/**
 * A pure descriptor of the accessibility editing fields a binding's
 * inspector should show for `element`, and the current values to bind them
 * to (empty string when unset, never `undefined`, so a binding can wire it
 * straight to a controlled text input). Mapping this onto a framework's own
 * form control is the only per-binding work.
 */
export interface NonVisualDescriptionFields {
	/** Show an alt-text (description) editor for this element. */
	showAltText: boolean;
	/** Show a title editor for this element. */
	showTitle: boolean;
	/** Current alt-text value, or `''` when unset or not applicable. */
	altText: string;
	/** Current title value, or `''` when unset or not applicable. */
	title: string;
}

/** Reads `element.altText` / `element.title` without a per-type cast. */
function readStringField(element: PptxElement, field: 'altText' | 'title'): string {
	const value = (element as Partial<Record<'altText' | 'title', unknown>>)[field];
	return typeof value === 'string' ? value : '';
}

/**
 * Computes the alt-text / title field descriptor for `element`. See
 * {@link NonVisualDescriptionFields}.
 */
export function getNonVisualDescriptionFields(element: PptxElement): NonVisualDescriptionFields {
	const showAltText = supportsAltTextField(element.type);
	const showTitle = supportsTitleField(element.type);
	return {
		showAltText,
		showTitle,
		altText: showAltText ? readStringField(element, 'altText') : '',
		title: showTitle ? readStringField(element, 'title') : '',
	};
}
