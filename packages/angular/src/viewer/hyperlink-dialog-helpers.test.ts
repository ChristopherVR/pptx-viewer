/**
 * hyperlink-dialog-helpers.test.ts: Unit tests for the hyperlink-dialog
 * helpers. Ports the Vue `HyperlinkDialog.test.ts` coverage (prefill, set /
 * clear / empty-as-clear, action-verb preservation) plus URL-safety guarding,
 * against the pure helpers, no Angular TestBed.
 */

import type { PptxAction, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildClearHyperlinkPatch,
	buildHyperlinkPatch,
	hasExistingLink,
	seedHyperlinkDraft,
} from './hyperlink-dialog-helpers';

function element(actionClick?: PptxAction): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		actionClick,
	} as PptxElement;
}

describe('hasExistingLink', () => {
	it('is true when the element has an actionClick.url', () => {
		expect(hasExistingLink(element({ url: 'https://x.test' }))).toBeTruthy();
	});

	it('is false for no element, no actionClick, or empty url', () => {
		expect(hasExistingLink(null)).toBeFalsy();
		expect(hasExistingLink(element())).toBeFalsy();
		expect(hasExistingLink(element({ url: '' }))).toBeFalsy();
	});
});

describe('seedHyperlinkDraft', () => {
	it('prefills url and tooltip from the element', () => {
		const draft = seedHyperlinkDraft(
			element({ url: 'https://existing.test', tooltip: 'Go there' }),
		);
		expect(draft).toStrictEqual({ url: 'https://existing.test', tooltip: 'Go there' });
	});

	it('coerces absent values to empty strings (incl. null element)', () => {
		expect(seedHyperlinkDraft(null)).toStrictEqual({ url: '', tooltip: '' });
		expect(seedHyperlinkDraft(element())).toStrictEqual({ url: '', tooltip: '' });
	});
});

describe('buildHyperlinkPatch', () => {
	it('sets actionClick.url on apply', () => {
		const patch = buildHyperlinkPatch(element(), { url: 'https://new.test', tooltip: '' });
		expect(patch.actionClick?.url).toBe('https://new.test');
		expect(patch.actionClick?.tooltip).toBeUndefined();
	});

	it('carries a non-blank tooltip and drops a blank one', () => {
		expect(
			buildHyperlinkPatch(element(), { url: 'https://x.test', tooltip: '  hi  ' }).actionClick
				?.tooltip,
		).toBe('hi');
		expect(
			buildHyperlinkPatch(element(), { url: 'https://x.test', tooltip: '   ' }).actionClick
				?.tooltip,
		).toBeUndefined();
	});

	it('treats an emptied URL as a clear', () => {
		const patch = buildHyperlinkPatch(element({ url: 'https://existing.test' }), {
			url: '',
			tooltip: '',
		});
		expect('actionClick' in patch).toBeTruthy();
		expect(patch.actionClick).toBeUndefined();
	});

	it('preserves an existing OOXML action verb when setting a URL', () => {
		const patch = buildHyperlinkPatch(element({ action: 'ppaction://hlinksldjump', url: '' }), {
			url: 'https://override.test',
			tooltip: '',
		});
		expect(patch.actionClick?.url).toBe('https://override.test');
		expect(patch.actionClick?.action).toBe('ppaction://hlinksldjump');
	});

	it('clears (does not apply) an unsafe javascript: URL', () => {
		const unsafe = `${'java'}script:alert(1)`;
		const patch = buildHyperlinkPatch(element(), { url: unsafe, tooltip: '' });
		expect(patch.actionClick).toBeUndefined();
	});
});

describe('buildClearHyperlinkPatch', () => {
	it('returns a clearing patch', () => {
		const patch = buildClearHyperlinkPatch();
		expect('actionClick' in patch).toBeTruthy();
		expect(patch.actionClick).toBeUndefined();
	});
});
