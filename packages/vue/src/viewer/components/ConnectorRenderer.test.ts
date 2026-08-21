import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ConnectorRenderer from './ConnectorRenderer.vue';

function connector(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'connector',
		id: 'cxn 1',
		x: 10,
		y: 20,
		width: 200,
		height: 0,
		shapeStyle: { strokeColor: '#ff0000', strokeWidth: 3 },
		...overrides,
	} as PptxElement;
}

// ── Straight connector (existing behaviour) ───────────────────────────────────

describe('connectorRenderer', () => {
	it('renders an svg line with the stroke colour and width', () => {
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 1 } });
		const line = wrapper.get('line');
		expect(line.attributes('stroke')).toBe('#ff0000');
		expect(line.attributes('stroke-width')).toBe('3');
	});

	it('spans the bounding box, mirrored by flip flags', () => {
		const plain = mount(ConnectorRenderer, {
			props: { element: connector({ width: 100, height: 40 }), zIndex: 0 },
		});
		const l1 = plain.get('line');
		expect(l1.attributes('x1')).toBe('0');
		expect(l1.attributes('x2')).toBe('100');

		const flipped = mount(ConnectorRenderer, {
			props: { element: connector({ width: 100, height: 40, flipHorizontal: true }), zIndex: 0 },
		});
		const l2 = flipped.get('line');
		expect(l2.attributes('x1')).toBe('100');
		expect(l2.attributes('x2')).toBe('0');
	});

	it('adds an end-arrow marker when configured', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({ shapeStyle: { connectorEndArrow: 'triangle' } }),
				zIndex: 0,
			},
		});
		const line = wrapper.get('line');
		expect(line.attributes('marker-end')).toContain('url(#');
		// id is sanitised from the element id ("cxn 1" → "cxn_1")
		expect(wrapper.find('marker#cxn_1-end').exists()).toBeTruthy();
	});

	it('omits markers when no arrows are set', () => {
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 0 } });
		expect(wrapper.find('marker').exists()).toBeFalsy();
		expect(wrapper.get('line').attributes('marker-end')).toBeUndefined();
	});

	it('sizes the marker box from the shared markerPath (med default is 4)', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({ shapeStyle: { connectorEndArrow: 'triangle' } }),
				zIndex: 0,
			},
		});
		const marker = wrapper.get('marker#cxn_1-end');
		expect(marker.attributes('markerWidth')).toBe('4');
		expect(marker.attributes('markerHeight')).toBe('4');
	});

	it('scales the marker box for lg length / sm width arrow-size tokens', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeStyle: {
						connectorEndArrow: 'triangle',
						connectorEndArrowLength: 'lg',
						connectorEndArrowWidth: 'sm',
					},
				}),
				zIndex: 0,
			},
		});
		const marker = wrapper.get('marker#cxn_1-end');
		// markerWidth follows @len (lg = 1.5 * 4 = 6); markerHeight follows @w (sm = 0.6 * 4 = 2.4).
		expect(marker.attributes('markerWidth')).toBe('6');
		expect(marker.attributes('markerHeight')).toBe('2.4');
	});
});

// ── Bent connector routing ────────────────────────────────────────────────────

describe('connectorRenderer - bent connectors', () => {
	it('renders a <path> (not a <line>) for bentConnector2', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector2',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('path').exists()).toBeTruthy();
		// No plain <line> elements: multi-segment replaces them
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('renders a multi-segment <path> for bentConnector3', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector3',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		const path = wrapper.get('path');
		const d = path.attributes('d') ?? '';
		// Must contain at least 3 L segments (not a straight diagonal)
		const lCount = (d.match(/\bL\b/gu) ?? []).length;
		expect(lCount).toBeGreaterThanOrEqual(3);
	});

	it('renders a <path> for bentConnector4', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector4',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('path').exists()).toBeTruthy();
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('renders a <path> for bentConnector5', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector5',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('path').exists()).toBeTruthy();
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('passes stroke colour through to the bent-connector path', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector3',
					width: 200,
					height: 100,
					shapeStyle: { strokeColor: '#0000ff', strokeWidth: 2 },
				}),
				zIndex: 0,
			},
		});
		// Skip the invisible hit target, which paints nothing.
		const path = wrapper.get('path:not(.pptx-vue-connector-hit)');
		expect(path.attributes('stroke')).toBe('#0000ff');
	});

	it('bends around a horizontal mid-line, not a vertical one, when the shapes are stacked', () => {
		// A connector between vertically-stacked shapes is taller than it is
		// wide (height > width). Before the fix, the SVG path bent around a
		// vertical mid-line at `width * adj1` regardless of orientation, so the
		// rendered connector still exited sideways even though the two shapes
		// it joins sit one above the other. Assert the actual rendered `d`
		// attribute, not just segment counts, so this exercises Vue's real
		// render path end to end rather than just the underlying core function.
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector3',
					width: 50,
					height: 200,
				}),
				zIndex: 0,
			},
		});
		const path = wrapper.get('path:not(.pptx-vue-connector-hit)');
		expect(path.attributes('d')).toBe('M 0 0 L 0 100 L 50 100 L 50 200');
	});
});

// ── Pointer hit target ────────────────────────────────────────────────────────

describe('connectorRenderer - hit target', () => {
	it('opts the line itself back into hit testing so it can be selected', () => {
		// The wrapper is `pointer-events: none`, so without this stroke no click
		// on the canvas could ever reach a connector and the inspector's
		// arrowhead card was unreachable by pointer.
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 0 } });
		const hit = wrapper.get('path.pptx-vue-connector-hit');
		expect(hit.attributes('stroke')).toBe('transparent');
		expect(hit.attributes('style')).toContain('pointer-events: stroke');
		// Wide enough to hit: 3x the stroke, floored at 14px, matching React.
		expect(Number(hit.attributes('stroke-width'))).toBe(14);
	});

	it('follows the routed path for a bent connector', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({ shapeType: 'bentConnector3', width: 200, height: 100 }),
				zIndex: 0,
			},
		});
		const hit = wrapper.get('path.pptx-vue-connector-hit');
		const visible = wrapper.get('path:not(.pptx-vue-connector-hit)');
		expect(hit.attributes('d')).toBe(visible.attributes('d'));
	});
});

// ── Curved connector routing ──────────────────────────────────────────────────

describe('connectorRenderer - curved connectors', () => {
	it('renders a <path> with Q (quadratic Bezier) for curvedConnector2', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'curvedConnector2',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('d')).toMatch(/Q/u);
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('renders a <path> with C (cubic Bezier) for curvedConnector3', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'curvedConnector3',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('d')).toMatch(/C/u);
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('renders a <path> with C for curvedConnector4', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'curvedConnector4',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('path').attributes('d')).toMatch(/C/u);
	});

	it('renders a <path> with C for curvedConnector5', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'curvedConnector5',
					width: 200,
					height: 100,
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('path').attributes('d')).toMatch(/C/u);
	});
});

// ── Compound line rendering ───────────────────────────────────────────────────

describe('connectorRenderer - compound lines', () => {
	it('renders two <line> elements for a straight dbl compound connector', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					width: 200,
					height: 0,
					shapeStyle: { strokeColor: '#333', strokeWidth: 4, compoundLine: 'dbl' },
				}),
				zIndex: 0,
			},
		});
		const lines = wrapper.findAll('line');
		expect(lines).toHaveLength(2);
	});

	it('renders three <line> elements for a straight tri compound connector', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					width: 200,
					height: 0,
					shapeStyle: { strokeColor: '#333', strokeWidth: 4, compoundLine: 'tri' },
				}),
				zIndex: 0,
			},
		});
		const lines = wrapper.findAll('line');
		expect(lines).toHaveLength(3);
	});

	it('renders two <path> elements for a bent dbl compound connector', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeType: 'bentConnector3',
					width: 200,
					height: 100,
					shapeStyle: { strokeColor: '#333', strokeWidth: 4, compoundLine: 'dbl' },
				}),
				zIndex: 0,
			},
		});
		// Visible strokes only; the invisible hit target is not one of them.
		const paths = wrapper.findAll('path:not(.pptx-vue-connector-hit)');
		expect(paths).toHaveLength(2);
		expect(wrapper.find('line').exists()).toBeFalsy();
	});

	it('attaches start arrow only to first compound stroke', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					width: 200,
					height: 0,
					shapeStyle: {
						strokeColor: '#333',
						strokeWidth: 4,
						compoundLine: 'dbl',
						connectorStartArrow: 'triangle',
						connectorEndArrow: 'triangle',
					},
				}),
				zIndex: 0,
			},
		});
		const lines = wrapper.findAll('line');
		expect(lines).toHaveLength(2);
		// Only first line has marker-start
		expect(lines[0]!.attributes('marker-start')).toContain('url(#');
		expect(lines[1]!.attributes('marker-start')).toBeUndefined();
		// Only last line has marker-end
		expect(lines[1]!.attributes('marker-end')).toContain('url(#');
		expect(lines[0]!.attributes('marker-end')).toBeUndefined();
	});
});

// ── Dash array ────────────────────────────────────────────────────────────────

describe('connectorRenderer - dash array', () => {
	it('applies stroke-dasharray for dot dash', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeStyle: { strokeColor: '#000', strokeWidth: 2, strokeDash: 'dot' },
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('line').attributes('stroke-dasharray')).toBe('2 2');
	});

	it('omits stroke-dasharray for solid', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					shapeStyle: { strokeColor: '#000', strokeWidth: 2, strokeDash: 'solid' },
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('line').attributes('stroke-dasharray')).toBeUndefined();
	});

	// ── Connector text overlay ────────────────────────────────────────────────

	it('renders no text overlay when the connector has no textSegments', () => {
		const wrapper = mount(ConnectorRenderer, { props: { element: connector(), zIndex: 0 } });
		expect(wrapper.find('.pptx-vue-connector-text').exists()).toBeFalsy();
	});

	it('renders a centred label from textSegments', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					text: 'Yes',
					textSegments: [{ text: 'Yes' }],
				}),
				zIndex: 0,
			},
		});
		const overlay = wrapper.get('.pptx-vue-connector-text');
		expect(overlay.text()).toBe('Yes');
		// Defaults to centre alignment.
		expect(overlay.attributes('style')).toContain('text-align: center');
	});

	it('applies per-segment run styling (bold + colour)', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					text: 'A B',
					textSegments: [
						{ text: 'A', style: { bold: true } },
						{ text: ' B', style: { color: '#00ff00' } },
					],
				}),
				zIndex: 0,
			},
		});
		const runs = wrapper.findAll('.pptx-vue-connector-text__run');
		expect(runs).toHaveLength(2);
		expect(runs[0].attributes('style')).toContain('font-weight: bold');
		expect(runs[1].attributes('style')).toContain('color: #00ff00');
	});

	it('maps justify-variant alignment to text-align: justify', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({
					text: 'X',
					textSegments: [{ text: 'X' }],
					textStyle: { align: 'dist' },
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('.pptx-vue-connector-text').attributes('style')).toContain(
			'text-align: justify',
		);
	});

	it('does not render the overlay when the label text is empty', () => {
		const wrapper = mount(ConnectorRenderer, {
			props: {
				element: connector({ text: '   ', textSegments: [] }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('.pptx-vue-connector-text').exists()).toBeFalsy();
	});
});
