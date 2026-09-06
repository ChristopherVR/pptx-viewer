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
		const media = {
			type: 'media',
			id: 'm1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		};
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
				shape({
					fillColor: '#ff0000',
					reflectionStartOpacity: 0.5,
					reflectionDistance: 4,
				}),
			);
			expect(html).toContain('pptx-react-reflection');
			expect(html).not.toContain('box-reflect');
			expect(html).not.toContain('WebkitBoxReflect');
			expect(html).toContain('mask-image');
		});

		it('paints the reflected fill from the resolved solid colour for a shape', () => {
			const html = render(
				shape({
					fillColor: '#ff0000',
					reflectionStartOpacity: 0.5,
					reflectionDistance: 4,
				}),
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
			expect(html).toContain('overflow:hidden');
		});

		it('keeps a reflected cropped picture inside a stationary shape mask', () => {
			const picture = {
				type: 'picture',
				id: 'pic-crop',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				imageData: 'data:image/png;base64,AAAA',
				shapeType: 'ellipse',
				cropLeft: 0.1,
				cropRight: 0.1,
				shapeStyle: { reflectionStartOpacity: 0.5 },
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={picture} />);
			expect(html).toContain('pptx-react-reflection');
			expect(html).toContain('border-radius:50%');
			expect(html).toContain('transform:translate(');
		});

		it('renders nothing extra when there is no reflection', () => {
			expect(render(shape({ fillColor: '#ffffff' }))).not.toContain('pptx-react-reflection');
		});

		it("mirrors the shape's own text body, not just its resolved fill", () => {
			const textShape = {
				type: 'shape',
				id: 'sp-text',
				x: 0,
				y: 0,
				width: 200,
				height: 80,
				shapeStyle: { fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				text: 'Hello reflected world',
				textSegments: [{ text: 'Hello reflected world' }],
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={textShape} />);
			const reflectionStart = html.indexOf('pptx-react-reflection');
			expect(reflectionStart).toBeGreaterThan(-1);
			expect(html.slice(reflectionStart)).toContain('Hello reflected world');
		});

		it('does not recurse into a second mirror inside its own mirrored clone', () => {
			const textShape = {
				type: 'shape',
				id: 'sp-text',
				x: 0,
				y: 0,
				width: 200,
				height: 80,
				shapeStyle: { fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={textShape} />);
			// Exactly one reflection wrapper: the clone inside it must not grow its own.
			expect(html.match(/pptx-react-reflection"/gu)?.length).toBe(1);
		});

		it('mirrors a reflected group by recursing into its children', () => {
			const group = {
				type: 'group',
				id: 'grp1',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				children: [
					{
						type: 'shape',
						id: 'child1',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						shapeStyle: { fillColor: '#00ff00' },
						text: 'Child text',
						textSegments: [{ text: 'Child text' }],
					},
				],
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={group} />);
			expect(html).toContain('pptx-react-reflection');
			expect(html).toContain('Child text');
			expect(html).toContain('#00ff00');
		});

		it('renders nothing for a group with no groupFill reflection', () => {
			const group = {
				type: 'group',
				id: 'grp-none',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				children: [],
			} as unknown as PptxElement;
			expect(render(group)).toBe('');
		});

		it('double-mirrors a child that carries its own reflection inside a reflected group', () => {
			const group = {
				type: 'group',
				id: 'grp-nested',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				children: [
					{
						type: 'shape',
						id: 'child-own-reflection',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						shapeStyle: {
							fillColor: '#00ff00',
							reflectionStartOpacity: 0.5,
							reflectionDistance: 2,
						},
					},
				],
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={group} />);
			// One wrapper for the group's own mirror, one nested inside it for the
			// child's own reflection: the child is not the element being mirrored,
			// so `suppressReflection` must not have been propagated to it.
			expect(html.match(/pptx-react-reflection"/gu)?.length).toBe(2);
		});
	});

	describe('group-level shadow/glow/soft-edge', () => {
		it('injects the soft-edge <filter> for a group carrying p:grpSpPr/a:effectLst/a:softEdge', () => {
			const group = {
				type: 'group',
				id: 'grp-soft',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: { softEdgeRadius: 6 },
				children: [],
			} as unknown as PptxElement;
			const html = renderToStaticMarkup(<ShapeEffectOverlay element={group} />);
			expect(html).toContain('id="soft-edge-grp-soft"');
			expect(html).toContain('feGaussianBlur');
		});
	});

	it('masks a picture fill overlay without clipping outer effects', () => {
		const picture = {
			type: 'picture',
			id: 'pic-overlay',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			shapeType: 'ellipse',
			imageData: 'data:image/png;base64,AAAA',
			shapeStyle: {
				dagFillOverlayColor: '#ff0000',
				dagFillOverlayBlend: 'mult',
			},
		} as unknown as PptxElement;
		const html = renderToStaticMarkup(<ShapeEffectOverlay element={picture} />);
		expect(html).toContain('pptx-react-fill-overlay');
		expect(html).toContain('border-radius:50%');
		expect(html).toContain('overflow:hidden');
	});
});
