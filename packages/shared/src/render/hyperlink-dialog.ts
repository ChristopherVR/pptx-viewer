/**
 * Pure helpers for the hyperlink-edit dialog, shared by every binding.
 *
 * Builds the `{ actionClick }` merge patch from a URL + tooltip draft, storing
 * the link on the element-level `actionClick` field (a `PptxAction`):
 *  - **Set:** `{ actionClick: { ...existing, url, tooltip } }` (any preexisting
 *    OOXML `action` verb on the element is preserved so slide-jump links
 *    survive).
 *  - **Clear:** `{ actionClick: undefined }` (empty URL, an unsafe URL, or an
 *    explicit "Remove link").
 *
 * Reuses the URL-safety guard from `hyperlink-security` so the dialog never
 * applies an unsafe href (e.g. `javascript:` / `data:`).
 */

import type { PptxAction, PptxElement } from 'pptx-viewer-core';

import { isPpactionUrl, isUrlSafe } from './hyperlink-security';

/** Whether the element already has a hyperlink URL set. */
export function hasExistingLink(element: PptxElement | null): boolean {
	return Boolean(element?.actionClick?.url);
}

/** The current URL + tooltip seeded into the form from an element. */
export interface HyperlinkDraft {
	url: string;
	tooltip: string;
}

/** Read the element's current `actionClick.url` / `.tooltip` into a draft. */
export function seedHyperlinkDraft(element: PptxElement | null): HyperlinkDraft {
	return {
		url: element?.actionClick?.url ?? '',
		tooltip: element?.actionClick?.tooltip ?? '',
	};
}

/**
 * Build the merge patch for applying the dialog's draft to an element.
 *
 * Returns `{ actionClick: undefined }` (a clearing patch) when:
 *  - the trimmed URL is empty, or
 *  - the URL is unsafe (blocked scheme) and is NOT a preserved `ppaction://`
 *    verb.
 *
 * Otherwise returns `{ actionClick: { ...existing, url, tooltip } }`, dropping
 * the tooltip when blank and preserving any existing OOXML `action` verb.
 */
export function buildHyperlinkPatch(
	element: PptxElement,
	draft: HyperlinkDraft,
): Partial<PptxElement> {
	const trimmedUrl = draft.url.trim();
	const trimmedTooltip = draft.tooltip.trim();

	if (trimmedUrl === '') {
		return { actionClick: undefined };
	}

	// Block unsafe external schemes. `ppaction://` slide-jump targets are an
	// internal action, not a navigable href, so they are not subject to the
	// href-safety check.
	if (!isPpactionUrl(trimmedUrl) && !isUrlSafe(trimmedUrl)) {
		return { actionClick: undefined };
	}

	const existing = element.actionClick;
	const actionClick: PptxAction = {
		...existing,
		url: trimmedUrl,
		tooltip: trimmedTooltip === '' ? undefined : trimmedTooltip,
	};
	return { actionClick };
}

/** A patch that clears the element's hyperlink entirely. */
export function buildClearHyperlinkPatch(): Partial<PptxElement> {
	return { actionClick: undefined };
}
