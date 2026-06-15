/**
 * properties-dialog-helpers.ts — Pure (no Angular) helpers for the document
 * properties dialog.
 *
 * Mirrors the read / format / diff logic of the Vue `PropertiesDialog.vue`:
 * seed an editable draft from the core properties, format read-only
 * timestamps, and build a minimal `Partial<PptxCoreProperties>` patch that
 * carries only the fields the user actually changed.
 *
 * No `any`; all regexes use the `/u` flag; no `String.prototype.replaceAll`,
 * no regex named-capture-groups (ng-packagr lib-target constraints).
 */

import type { PptxCoreProperties } from 'pptx-viewer-core';

/**
 * Subset of {@link PptxCoreProperties} surfaced by the Properties dialog: the
 * editable metadata (title / creator / subject / keywords) plus read-only
 * timestamps (created / modified).
 */
export type DocumentProperties = Pick<
	PptxCoreProperties,
	'title' | 'creator' | 'subject' | 'keywords' | 'created' | 'modified'
>;

/** The editable draft fields, all coerced to non-null strings. */
export interface PropertiesDraft {
	title: string;
	creator: string;
	subject: string;
	keywords: string;
}

/**
 * Build an editable draft from the source properties, coercing each absent
 * field to an empty string.
 */
export function seedPropertiesDraft(properties: DocumentProperties): PropertiesDraft {
	return {
		title: properties.title ?? '',
		creator: properties.creator ?? '',
		subject: properties.subject ?? '',
		keywords: properties.keywords ?? '',
	};
}

/**
 * Format a (possibly absent or invalid) ISO timestamp for display. Returns an
 * em-dash for missing values and echoes the raw string for unparseable ones.
 */
export function formatPropertyDate(value: string | undefined): string {
	if (!value) {
		return '—';
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Diff an edited draft against the source properties and produce a patch that
 * contains only the changed editable fields. An untouched dialog yields `{}`.
 */
export function buildPropertiesPatch(
	properties: DocumentProperties,
	draft: PropertiesDraft,
): Partial<PptxCoreProperties> {
	const next: Partial<PptxCoreProperties> = {};
	if (draft.title !== (properties.title ?? '')) {
		next.title = draft.title;
	}
	if (draft.creator !== (properties.creator ?? '')) {
		next.creator = draft.creator;
	}
	if (draft.subject !== (properties.subject ?? '')) {
		next.subject = draft.subject;
	}
	if (draft.keywords !== (properties.keywords ?? '')) {
		next.keywords = draft.keywords;
	}
	return next;
}
