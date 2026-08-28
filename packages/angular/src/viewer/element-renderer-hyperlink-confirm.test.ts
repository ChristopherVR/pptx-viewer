/**
 * Unit tests for the Trust Center > "Confirm before opening external
 * hyperlinks" gate on a text-run hyperlink click.
 *
 * TestBed rendering is unavailable in this package (see
 * `element-renderer-hidden.test.ts`), so the pure predicate the component's
 * `onHyperlinkClick` delegates to is pinned directly. The anchor itself
 * (`<a class="pptx-ng-link" href=... target="_blank">` in
 * `element-renderer.component.html`) still does the actual navigation; this
 * predicate only decides whether `event.preventDefault()` should veto it.
 */
import { describe, expect, it, vi } from 'vitest';

import { shouldPreventHyperlinkNavigation } from './element-renderer.component';

describe('shouldPreventHyperlinkNavigation', () => {
	it('never prevents navigation when no confirm hook is wired (outside a full viewer host)', () => {
		expect(shouldPreventHyperlinkNavigation(undefined, 'https://example.com')).toBeFalsy();
	});

	it('prevents navigation when the confirm hook declines', () => {
		const confirm = vi.fn().mockReturnValue(false);
		expect(shouldPreventHyperlinkNavigation(confirm, 'https://example.com')).toBeTruthy();
		expect(confirm).toHaveBeenCalledWith('https://example.com');
	});

	it('allows navigation when the confirm hook accepts', () => {
		const confirm = vi.fn().mockReturnValue(true);
		expect(shouldPreventHyperlinkNavigation(confirm, 'https://example.com')).toBeFalsy();
	});
});
