/**
 * Tests for the Angular SmartArt renderer's consumption of the shared layout
 * engine.
 *
 * Angular component tests cannot use TestBed here (the project has no
 * `@analogjs/vite-plugin-angular` setup yet), so instead of
 * mounting the component we exercise the exact shared-engine call the component
 * makes (`computeSmartArtLayout` via the vendored `../internal/shared` barrel,
 * with the same inputs the component passes) and assert the returned
 * `RenderedNode` / `RenderedConnector` view-models map to the SVG primitives the
 * template renders. This mirrors the spirit of the Vue `SmartArtRenderer.test.ts`
 * family-dispatch coverage and guarantees Angular produces the same geometry as
 * the other bindings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxSmartArtNode, SmartArtLayoutType } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeSmartArtLayout } from '../internal/shared';
import type { RenderedNode, SmartArtLayoutResult } from '../internal/shared';
import { DEFAULT_PALETTE } from './smart-art-drawing';
import { layoutConnectorPaints, layoutNodeLabels } from './smart-art-renderer-helpers';

const BOX = { width: 400, height: 300 };

function node(id: string, text: string, over: Partial<PptxSmartArtNode> = {}): PptxSmartArtNode {
	return { id, text, ...over };
}

/** Call the shared engine the same way `SmartArtRendererComponent.layout()` does. */
function layoutFor(
	nodes: PptxSmartArtNode[],
	resolvedLayoutType?: SmartArtLayoutType,
): SmartArtLayoutResult {
	return computeSmartArtLayout(nodes, BOX, DEFAULT_PALETTE, 'flat', 'dgm-1', resolvedLayoutType);
}

function kinds(result: SmartArtLayoutResult): Array<RenderedNode['kind']> {
	return result.nodes.map((n) => n.kind);
}

function texts(result: SmartArtLayoutResult): string[] {
	return result.nodes.map((n) => n.text);
}

describe('smartArtRenderer shared-engine layout', () => {
	it('produces rect nodes for the default list family', () => {
		const result = layoutFor([node('1', 'Alpha'), node('2', 'Beta')], 'list');
		expect(result.family).toBe('list');
		expect(kinds(result)).toStrictEqual(['rect', 'rect']);
		expect(texts(result)).toStrictEqual(['Alpha', 'Beta']);
	});

	it('produces polygon nodes for the process family', () => {
		const result = layoutFor([node('1', 'Step 1'), node('2', 'Step 2')], 'process');
		expect(result.family).toBe('process');
		expect(result.nodes.every((n) => n.kind === 'polygon')).toBeTruthy();
	});

	it('produces circle nodes plus ring connectors for the cycle family', () => {
		const result = layoutFor([node('1', 'A'), node('2', 'B'), node('3', 'C')], 'cycle');
		expect(result.family).toBe('cycle');
		expect(result.nodes.every((n) => n.kind === 'circle')).toBeTruthy();
		expect(result.connectors.length).toBeGreaterThan(0);
		// Connectors expose an SVG path `d` string that the template binds to <path>.
		expect(result.connectors[0].d.startsWith('M')).toBeTruthy();
	});

	it('produces rect nodes and connector paths for the hierarchy family', () => {
		const nodes = [
			node('1', 'CEO'),
			node('2', 'VP Eng', { parentId: '1' }),
			node('3', 'VP Mktg', { parentId: '1' }),
		];
		const result = layoutFor(nodes, 'hierarchy');
		expect(result.family).toBe('hierarchy');
		expect(result.nodes.some((n) => n.kind === 'rect')).toBeTruthy();
		expect(result.connectors.length).toBeGreaterThanOrEqual(2);
	});

	it('produces a grid of rect nodes for the matrix family', () => {
		const nodes = [node('1', 'Q1'), node('2', 'Q2'), node('3', 'Q3'), node('4', 'Q4')];
		const result = layoutFor(nodes, 'matrix');
		expect(result.family).toBe('matrix');
		expect(result.nodes).toHaveLength(4);
		expect(result.nodes.every((n) => n.kind === 'rect')).toBeTruthy();
	});

	it('produces circle nodes for the relationship/radial family', () => {
		const result = layoutFor([node('1', 'Core'), node('2', 'A'), node('3', 'B')], 'relationship');
		expect(result.family).toBe('radial');
		expect(result.nodes.some((n) => n.kind === 'circle')).toBeTruthy();
	});

	it('produces polygon nodes for the pyramid family', () => {
		const result = layoutFor([node('1', 'Top'), node('2', 'Mid'), node('3', 'Base')], 'pyramid');
		expect(result.family).toBe('pyramid');
		expect(result.nodes.some((n) => n.kind === 'polygon')).toBeTruthy();
	});

	it('produces circle nodes for the venn family', () => {
		const result = layoutFor([node('1', 'A'), node('2', 'B'), node('3', 'C')], 'venn');
		expect(result.family).toBe('venn');
		expect(result.nodes.every((n) => n.kind === 'circle')).toBeTruthy();
	});

	it('produces polygon nodes for the funnel family', () => {
		const result = layoutFor([node('1', 'Top'), node('2', 'Mid'), node('3', 'Out')], 'funnel');
		expect(result.family).toBe('funnel');
		expect(result.nodes.some((n) => n.kind === 'polygon')).toBeTruthy();
	});

	it('produces circle nodes for the target family', () => {
		const result = layoutFor([node('1', 'A'), node('2', 'B'), node('3', 'C')], 'target');
		expect(result.family).toBe('target');
		expect(result.nodes.every((n) => n.kind === 'circle')).toBeTruthy();
	});

	it('flattens nested nodes into the rendered output', () => {
		const root = node('1', 'Root', {
			children: [node('2', 'Child A'), node('3', 'Child B')],
		});
		const result = layoutFor([root], 'list');
		const allText = texts(result).join(' ');
		expect(allText).toContain('Root');
		expect(allText).toContain('Child A');
		expect(allText).toContain('Child B');
	});

	it('exposes a viewBox string the template binds to the <svg>', () => {
		const result = layoutFor([node('1', 'A')], 'list');
		expect(result.viewBox).toMatch(/^0 0 \d/u);
	});

	it('carries fully-styled fill/stroke/fontSize on every node', () => {
		const result = layoutFor([node('1', 'A'), node('2', 'B')], 'list');
		for (const n of result.nodes) {
			expect(n.fill).toBeTypeOf('string');
			expect(n.stroke).toBeTypeOf('string');
			expect(n.fontSize).toBeGreaterThan(0);
		}
	});
});

/**
 * The optional paint / placement fields on the shared descriptor. This
 * template hardcoded `fill="white"` on every label, anchored circle labels on
 * `cx`/`cy`, and stroked every connector `#94a3b8` at 1.5/0.5, so a target
 * caption sat on the bullseye and a timeline caption on its dot.
 *
 * `layoutNodeLabels` / `layoutConnectorPaints` are the exact arrays the
 * component's `layoutLabels()` / `layoutConnectors()` computeds expose, and the
 * template binds nothing else; the template assertions below pin that wiring,
 * since a correct computed the template ignores is how this binding has drifted
 * before.
 */
describe('smartArtRenderer label + connector paint', () => {
	const three = [node('n1', 'One'), node('n2', 'Two'), node('n3', 'Three')];

	it('parks a target leader caption beside the ring in the node colour', () => {
		const labels = layoutNodeLabels(layoutFor(three, 'target'));
		const first = labels[0]!;
		// Not the circle centre (cx = 160): the descriptor's own textX / anchor.
		expect(first.x).toBe(310);
		expect(first.textAnchor).toBe('start');
		expect(first.fill).not.toBe('white');
		expect(first.lines).toStrictEqual([{ text: 'One', y: 13 }]);
	});

	it('stacks timeline captions above and below the axis', () => {
		const labels = layoutNodeLabels(layoutFor(three, 'timeline'));
		expect(labels[0]!.dominantBaseline).toBe('auto');
		expect(labels[0]!.lines[0]!.y).toBe(110);
		expect(labels[1]!.dominantBaseline).toBe('hanging');
		expect(labels[1]!.lines[0]!.y).toBe(190);
	});

	it('applies the node text style (gear hubs are bold)', () => {
		expect(layoutNodeLabels(layoutFor(three, 'gear'))[0]!.fontWeight).toBe(700);
	});

	it('keeps each timeline stem in its own node colour', () => {
		const paints = layoutConnectorPaints(layoutFor(three, 'timeline'));
		// The axis carries its own 2px full-opacity stroke, not the 1.5/0.5 default.
		expect(paints[0]!.strokeWidth).toBe(2);
		expect(paints[0]!.opacity).toBe(1);
		// Each stem is coloured; none of them is the hardcoded grey.
		expect(paints.slice(1).every((p) => p.stroke !== '#94a3b8')).toBeTruthy();
	});

	it('falls back to the documented defaults when a connector carries no paint', () => {
		const paint = layoutConnectorPaints(layoutFor(three, 'cycle'))[0]!;
		expect(paint.stroke).toBe('#94a3b8');
		expect(paint.strokeWidth).toBe(1.5);
		expect(paint.opacity).toBe(0.5);
	});
});

/**
 * Template wiring. Angular has no TestBed here, so the template is read as
 * text: these assert the fallback `<svg>` binds the shared descriptors rather
 * than the constants it used to hardcode.
 */
describe('smartArtRenderer template bindings', () => {
	const template = readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), 'smart-art-renderer.component.html'),
		'utf8',
	);

	it('binds the shared label descriptor instead of a hardcoded white fill', () => {
		expect(template).toContain('[attr.fill]="layoutLabels()[ni]!.fill"');
		expect(template).toContain('[attr.text-anchor]="layoutLabels()[ni]!.textAnchor"');
		expect(template).toContain('[attr.dominant-baseline]="layoutLabels()[ni]!.dominantBaseline"');
		expect(template).not.toContain('fill="white"');
	});

	it('binds the shared connector paint instead of a hardcoded grey stroke', () => {
		expect(template).toContain('[attr.stroke]="layoutConnectors()[ci]!.stroke"');
		expect(template).not.toContain('stroke="#94a3b8"');
	});
});
