import type { PptxHeaderFooter } from 'pptx-viewer-core';

/**
 * Clone a `PptxHeaderFooter` into a fresh draft object for the Header & Footer
 * dialog to mutate locally, without touching the committed value until the
 * user applies the change.
 */
export function cloneHeaderFooterDraft(value: PptxHeaderFooter | undefined): PptxHeaderFooter {
	return value ? { ...value } : {};
}

/** Merge a partial change into a Header & Footer draft, returning a new object. */
export function patchHeaderFooterDraft(
	draft: PptxHeaderFooter,
	patch: Partial<PptxHeaderFooter>,
): PptxHeaderFooter {
	return { ...draft, ...patch };
}

/** Whether the fixed-date text input should show, given the current draft. */
export function isHeaderFooterDateTextVisible(draft: PptxHeaderFooter): boolean {
	return Boolean(draft.hasDateTime) && !draft.dateTimeAuto;
}

/** Whether the header text input should show, given the current draft. */
export function isHeaderFooterHeaderTextVisible(draft: PptxHeaderFooter): boolean {
	return Boolean(draft.hasHeader);
}

/** Whether the footer text input should show, given the current draft. */
export function isHeaderFooterFooterTextVisible(draft: PptxHeaderFooter): boolean {
	return Boolean(draft.hasFooter);
}
