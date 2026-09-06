import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ShapeEffectOverlay from './ShapeEffectOverlay.vue';

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

describe('shapeEffectOverlay', () => {
	it('renders nothing when the element has no fill overlay or soft edge', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: { element: shape({ fillColor: '#ffffff' }) },
		});
		expect(wrapper.find('.pptx-vue-fill-overlay').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('paints a blended fill-overlay layer from a DAG fill overlay', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: shape({ dagFillOverlayColor: '#ff0000', dagFillOverlayBlend: 'mult' }),
			},
		});
		const layer = wrapper.get('.pptx-vue-fill-overlay');
		const style = layer.attributes('style') ?? '';
		expect(style).toContain('mix-blend-mode: multiply');
		expect(style).toContain('position: absolute');
		expect(style).toMatch(/background/u);
	});

	it('injects a soft-edge <filter> so filter: url(#soft-edge-<id>) resolves', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: { element: shape({ softEdgeRadius: 6 }) },
		});
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.html()).toContain('id="soft-edge-sp1"');
	});

	it('strokes a stroke-only ("open") preset instead of leaving a box border', () => {
		// `<a:prstGeom prst="line"/>` has no region to fill and no box to outline;
		// a CSS border drew a rectangle where PowerPoint draws the line itself.
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: {
					type: 'shape',
					id: 'rule-1',
					x: 0,
					y: 0,
					width: 400,
					height: 0,
					shapeType: 'line',
					shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
				} as unknown as PptxElement,
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('d')).toBe('M 0 0 L 400 1');
		expect(path.attributes('stroke')).toBe('#000000');
		// The viewBox is the PAINTED box (padded to MIN_ELEMENT_SIZE), so the rule
		// is not stretched into a diagonal.
		expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 400 12');
		expect(wrapper.html()).not.toContain('<defs');
	});

	it('leaves an explicitly INSET closed preset to its CSS border', () => {
		// `algn="in"` is the one alignment a CSS border already paints correctly,
		// so a closed preset must not ALSO get a painted SVG stroke outline. It
		// does still get the transparent pointer-events:stroke hit band, because
		// this fixture is unfilled and textless: a hollow frame, whose interior
		// must let clicks through to whatever it is drawn over.
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: {
					type: 'shape',
					id: 'sp2',
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					shapeType: 'rect',
					shapeStyle: { strokeColor: '#000000', strokeWidth: 2, lineAlignment: 'in' },
				} as unknown as PptxElement,
			},
		});
		expect(wrapper.html()).not.toContain('#000000');
		expect(wrapper.html()).toContain('transparent');
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: {
					type: 'shape',
					id: 'sp2',
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					shapeType: 'rect',
					shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
				} as unknown as PptxElement,
			},
		});
		expect(wrapper.html()).toContain('#000000');
	});

	describe('reflection', () => {
		it('renders a mirrored sibling with no -webkit-box-reflect', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: shape({
						fillColor: '#ff0000',
						reflectionStartOpacity: 0.5,
						reflectionDistance: 4,
					}),
				},
			});
			const layer = wrapper.get('.pptx-vue-reflection');
			const style = layer.attributes('style') ?? '';
			expect(style).not.toContain('box-reflect');
			expect(style).toContain('position: absolute');
			expect(style).toContain('transform: scaleY(-1)');
			// The `mask-image` value itself (jsdom's CSSOM does not model that
			// property, so it never round-trips through a mounted style attribute
			// in tests even though real browsers apply it) is covered directly by
			// `pptx-viewer-shared`'s `reflection.test.ts`.
			expect(wrapper.html()).not.toContain('box-reflect');
		});

		it('paints the reflected fill from the resolved solid colour for a shape', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: shape({
						fillColor: '#ff0000',
						reflectionStartOpacity: 0.5,
						reflectionDistance: 4,
					}),
				},
			});
			const layer = wrapper.get('.pptx-vue-reflection > div');
			expect(layer.attributes('style') ?? '').toContain('background-color: #ff0000');
		});

		it('paints a reflected <img> for a picture element', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
						type: 'picture',
						id: 'pic1',
						x: 0,
						y: 0,
						width: 100,
						height: 80,
						imageData: 'data:image/png;base64,AAAA',
						shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
					} as unknown as PptxElement,
				},
			});
			const img = wrapper.get('.pptx-vue-reflection img');
			expect(img.attributes('src')).toBe('data:image/png;base64,AAAA');
		});

		it('renders nothing extra when there is no reflection', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: { element: shape({ fillColor: '#ffffff' }) },
			});
			expect(wrapper.find('.pptx-vue-reflection').exists()).toBeFalsy();
		});

		it("mirrors the shape's own text body, not just its resolved fill", () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
						type: 'shape',
						id: 'sp-text',
						x: 0,
						y: 0,
						width: 200,
						height: 80,
						shapeStyle: {
							fillColor: '#ff0000',
							reflectionStartOpacity: 0.5,
							reflectionDistance: 4,
						},
						text: 'Hello reflected world',
						textSegments: [{ text: 'Hello reflected world' }],
					} as unknown as PptxElement,
				},
			});
			expect(wrapper.get('.pptx-vue-reflection').text()).toContain('Hello reflected world');
		});

		it('suppresses reflection when suppressReflection is set (no double-mirroring)', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: shape({
						fillColor: '#ff0000',
						reflectionStartOpacity: 0.5,
						reflectionDistance: 4,
					}),
					suppressReflection: true,
				},
			});
			expect(wrapper.find('.pptx-vue-reflection').exists()).toBeFalsy();
		});

		it('mirrors a reflected group by recursing into its children', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
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
					} as unknown as PptxElement,
				},
			});
			const layer = wrapper.get('.pptx-vue-reflection');
			expect(layer.text()).toContain('Child text');
			expect(layer.html()).toContain('#00ff00');
		});

		it('renders nothing for a group with no groupFill reflection', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
						type: 'group',
						id: 'grp-none',
						x: 0,
						y: 0,
						width: 200,
						height: 100,
						children: [],
					} as unknown as PptxElement,
				},
			});
			expect(wrapper.find('.pptx-vue-reflection').exists()).toBeFalsy();
		});

		it('double-mirrors a child that carries its own reflection inside a reflected group', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
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
					} as unknown as PptxElement,
				},
			});
			// One wrapper for the group's own mirror, one nested inside it for the
			// child's own reflection: the child is not the element being mirrored,
			// so `suppressReflection` (`topLevel`) must not have been forced on it.
			expect(wrapper.findAll('.pptx-vue-reflection')).toHaveLength(2);
		});
	});

	describe('group-level shadow/glow/soft-edge', () => {
		it('injects the soft-edge <filter> for a group carrying p:grpSpPr/a:effectLst/a:softEdge', () => {
			const wrapper = mount(ShapeEffectOverlay, {
				props: {
					element: {
						type: 'group',
						id: 'grp-soft',
						x: 0,
						y: 0,
						width: 200,
						height: 100,
						groupEffectStyle: { softEdgeRadius: 6 },
						children: [],
					} as unknown as PptxElement,
				},
			});
			expect(wrapper.html()).toContain('id="soft-edge-grp-soft"');
		});
	});
});
