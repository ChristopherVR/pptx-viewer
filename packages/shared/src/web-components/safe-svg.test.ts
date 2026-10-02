// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { parseSvgPreview } from './safe-svg';

const SVG = (inner: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4">${inner}</svg>`;

describe('parseSvgPreview', () => {
	it('returns a real SVG element for a valid preview and keeps its shapes', () => {
		const node = parseSvgPreview(document, SVG('<rect width="2" height="2" fill="#123456"/>'));
		expect(node?.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(node?.querySelector('rect')?.getAttribute('fill')).toBe('#123456');
	});

	it('strips scripts, foreign content, event handlers and javascript: URLs', () => {
		const node = parseSvgPreview(
			document,
			SVG(
				'<script>alert(1)</script><foreignObject><div/></foreignObject>' +
					'<rect width="2" height="2" onclick="alert(1)"/><a href="javascript:alert(1)"><circle r="1"/></a>',
			),
		);
		expect(node).not.toBeNull();
		expect(node?.querySelector('script')).toBeNull();
		expect(node?.querySelector('foreignObject')).toBeNull();
		expect(node?.querySelector('rect')?.hasAttribute('onclick')).toBeFalsy();
		expect(node?.querySelector('a')?.hasAttribute('href')).toBeFalsy();
	});

	it('rejects markup that is not a well-formed SVG root', () => {
		expect(parseSvgPreview(document, '<div>hi</div>')).toBeNull();
		expect(
			parseSvgPreview(document, '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>'),
		).toBeNull();
	});
});
