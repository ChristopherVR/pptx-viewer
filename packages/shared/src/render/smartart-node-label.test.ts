import { describe, expect, it } from 'vitest';

import type {
	RenderedCircleNode,
	RenderedConnector,
	RenderedRectNode,
} from './smartart-layout-types';
import { smartArtConnectorPaint, smartArtNodeLabel } from './smartart-node-label';

/**
 * The four non-React bindings hardcoded `fill="white"` and placed circle labels
 * on `cx`/`cy`, ignoring the optional descriptor fields the shared engine emits
 * for target captions, gear legend rows and timeline captions. These assert the
 * decision function every binding now maps.
 */

function circle(overrides: Partial<RenderedCircleNode> = {}): RenderedCircleNode {
	return {
		kind: 'circle',
		key: 'k',
		cx: 100,
		cy: 50,
		r: 10,
		fill: '#123456',
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: 'Label',
		fontSize: 10,
		...overrides,
	};
}

describe('smartArtNodeLabel', () => {
	it('defaults a plain circle label to the node centre in white', () => {
		const label = smartArtNodeLabel(circle());
		expect(label.visible).toBeTruthy();
		expect(label.x).toBe(100);
		expect(label.textAnchor).toBe('middle');
		expect(label.dominantBaseline).toBe('central');
		expect(label.fill).toBe('white');
		expect(label.fontWeight).toBeUndefined();
		expect(label.fontStyle).toBeUndefined();
		// Single line, centred on cy.
		expect(label.lines).toStrictEqual([{ text: 'Label', y: 50 }]);
	});

	it('honours a target-style leader label parked beside the ring', () => {
		const label = smartArtNodeLabel(
			circle({ textX: 220, textY: 54, textAnchor: 'start', fontColor: '#ff0000' }),
		);
		expect(label.x).toBe(220);
		expect(label.textAnchor).toBe('start');
		expect(label.fill).toBe('#ff0000');
		expect(label.lines[0]?.y).toBe(54);
	});

	it('stacks a timeline caption ABOVE its dot for textBaseline bottom', () => {
		const label = smartArtNodeLabel(
			circle({ text: 'One\nTwo', textY: 30, textBaseline: 'bottom', fontSize: 10 }),
		);
		expect(label.dominantBaseline).toBe('auto');
		// Last baseline sits on textY; lines stack upward by 1.2em.
		expect(label.lines).toStrictEqual([
			{ text: 'One', y: 18 },
			{ text: 'Two', y: 30 },
		]);
	});

	it('stacks a timeline caption BELOW its dot for textBaseline top', () => {
		const label = smartArtNodeLabel(
			circle({ text: 'One\nTwo', textY: 70, textBaseline: 'top', fontSize: 10 }),
		);
		expect(label.dominantBaseline).toBe('hanging');
		expect(label.lines).toStrictEqual([
			{ text: 'One', y: 70 },
			{ text: 'Two', y: 82 },
		]);
	});

	it('carries the node text style through to font weight / style', () => {
		const label = smartArtNodeLabel(circle({ fontWeight: 700, fontStyle: 'italic' }));
		expect(label.fontWeight).toBe(700);
		expect(label.fontStyle).toBe('italic');
	});

	it('reports an empty label as not visible', () => {
		expect(smartArtNodeLabel(circle({ text: '' })).visible).toBeFalsy();
	});

	it('centres rect labels on their own textX / textY', () => {
		const rect: RenderedRectNode = {
			kind: 'rect',
			key: 'r',
			x: 0,
			y: 0,
			width: 40,
			height: 20,
			rx: 4,
			fill: '#000',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'Box',
			fontSize: 10,
			textX: 20,
			textY: 10,
		};
		const label = smartArtNodeLabel(rect);
		expect(label.x).toBe(20);
		expect(label.textAnchor).toBe('middle');
		expect(label.dominantBaseline).toBe('central');
		expect(label.lines).toStrictEqual([{ text: 'Box', y: 10 }]);
	});
});

describe('smartArtConnectorPaint', () => {
	it('applies the documented defaults when the descriptor omits paint', () => {
		const paint = smartArtConnectorPaint({ key: 'c', d: 'M0,0 L1,1' });
		expect(paint).toStrictEqual({
			d: 'M0,0 L1,1',
			stroke: '#94a3b8',
			strokeWidth: 1.5,
			opacity: 0.5,
			dash: undefined,
		});
	});

	it('passes a coloured timeline stem through unchanged', () => {
		const connector: RenderedConnector = {
			key: 'c',
			d: 'M0,0 L0,10',
			stroke: '#ff8800',
			strokeWidth: 1,
			opacity: 0.5,
			dash: '4 2',
		};
		expect(smartArtConnectorPaint(connector)).toStrictEqual({
			d: 'M0,0 L0,10',
			stroke: '#ff8800',
			strokeWidth: 1,
			opacity: 0.5,
			dash: '4 2',
		});
	});
});
