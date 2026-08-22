import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ShapeEffectOverlay } from './ShapeEffectOverlay';

function shape(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'shape',
		id: 'sp1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		shapeStyle,
	} as unknown as PptxElement;
}

function render(element: PptxElement): string {
	return renderToStaticMarkup(<ShapeEffectOverlay element={element} />);
}

describe('shapeEffectOverlay', () => {
	it('renders nothing when the element has no fill overlay or soft edge', () => {
		expect(render(shape({ fillColor: '#ffffff' }))).toBe('');
	});

	it('renders nothing for an element without shape properties', () => {
		const media = { type: 'media', id: 'm1', x: 0, y: 0, width: 10, height: 10 };
		expect(render(media as unknown as PptxElement)).toBe('');
	});

	it('paints a blended fill-overlay layer from a DAG fill overlay', () => {
		const html = render(shape({ dagFillOverlayColor: '#ff0000', dagFillOverlayBlend: 'mult' }));
		expect(html).toContain('pptx-react-fill-overlay');
		expect(html).toContain('mix-blend-mode:multiply');
		expect(html).toContain('position:absolute');
		expect(html).toMatch(/background/u);
	});

	it('injects a soft-edge <filter> so filter: url(#soft-edge-<id>) resolves', () => {
		const html = render(shape({ softEdgeRadius: 6 }));
		expect(html).toContain('<svg');
		expect(html).toContain('id="soft-edge-sp1"');
		expect(html).toContain('feGaussianBlur');
	});

	it('does not paint a fill-overlay layer for a blend-only style (no overlay colour)', () => {
		const html = render(shape({ dagFillOverlayBlend: 'mult' }));
		expect(html).not.toContain('pptx-react-fill-overlay');
	});

	describe('reflection', () => {
		it('renders a mirrored sibling with no -webkit-box-reflect', () => {
			const html = render(
				shape({ fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 }),
			);
			expect(html).toContain('pptx-react-reflection');
			expect(html).not.toContain('box-reflect');
			expect(html).not.toContain('WebkitBoxReflect');
			expect(html).toContain('mask-image');
		});

		it('paints the reflected fill from the resolved solid colour for a shape', () => {
			const html = render(
				shape({ fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 }),
			);
			expect(html).toContain('background-color:#ff0000');
		});

		it('paints a reflected <img> for a picture element', () => {
			const picture = {
				type: 'picture',
				id: 'pic1',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				imageData: 'data:image/png;base64,AAAA',
				shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={picture} />);
			expect(html).toContain('pptx-react-reflection');
			expect(html).toContain('<img');
			expect(html).toContain('data:image/png;base64,AAAA');
		});

		it('renders nothing extra when there is no reflection', () => {
			expect(render(shape({ fillColor: '#ffffff' }))).not.toContain('pptx-react-reflection');
		});
	});
});
