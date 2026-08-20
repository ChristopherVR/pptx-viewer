import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { wrapChrome } from './smartart-renderer-utils';

/**
 * `wrapChrome` repoints its background/outline decision onto the shared
 * `buildChromeStyle` (`pptx-viewer-shared`), the same function
 * Angular/Svelte/Vanilla call directly. These assert the camelCase adapter
 * carries that decision through correctly rather than re-deciding it.
 */
describe('wrapChrome', () => {
	it('applies no background/border when chrome is undefined', () => {
		const html = renderToStaticMarkup(wrapChrome(undefined, <span>content</span>, 'my-class'));
		expect(html).not.toContain('background-color');
		// `box-sizing:border-box` is always present; only a real `border:` rule
		// (from `chrome.outlineColor`) is what must be absent here.
		expect(html).not.toContain('border:');
		expect(html).toContain('my-class');
	});

	it('applies background-color from chrome.backgroundColor', () => {
		const html = renderToStaticMarkup(
			wrapChrome({ backgroundColor: '#f0f0f0' }, <span>content</span>, 'c'),
		);
		expect(html).toContain('background-color:#f0f0f0');
	});

	it('applies a border using outlineWidth and outlineColor', () => {
		const html = renderToStaticMarkup(
			wrapChrome({ outlineColor: '#333333', outlineWidth: 2 }, <span>content</span>, 'c'),
		);
		expect(html).toContain('border:2px solid #333333');
	});

	it('defaults outline width to 1px when omitted', () => {
		const html = renderToStaticMarkup(
			wrapChrome({ outlineColor: '#00ff00' }, <span>content</span>, 'c'),
		);
		expect(html).toContain('border:1px solid #00ff00');
	});

	it('applies container-level accessibility props when supplied', () => {
		const html = renderToStaticMarkup(
			wrapChrome(undefined, <span>content</span>, 'c', { role: 'img', label: 'A diagram' }),
		);
		expect(html).toContain('role="img"');
		expect(html).toContain('aria-label="A diagram"');
	});
});
