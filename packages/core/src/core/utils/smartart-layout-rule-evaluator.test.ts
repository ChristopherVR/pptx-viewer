import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { computeSmartArtLayout } from './smartart-layout-engine';
import { evaluateLayoutRules } from './smartart-layout-rule-evaluator';

const nodes: PptxSmartArtNode[] = [
	{ id: 'root', text: 'Root', nodeType: 'node' },
	{ id: 'child', text: 'Child', nodeType: 'node', parentId: 'root' },
	{ id: 'assistant', text: 'Assistant', nodeType: 'asst', parentId: 'root' },
];

describe('smartArt numeric layout rules', () => {
	it('evaluates values, factors, maxima, filters, and safe global controls', () => {
		const rules = [
			{ type: 'sp', val: 0.05, fact: 2, max: 0.08 },
			{ type: 'cols', val: 2.6 },
			{ type: 'aspectRatio', val: 0.3 },
			{ type: 'dir', val: 1 },
			{ type: 'w', forName: 'child', val: 0.4, max: 0.3 },
			{ type: 'h', ptType: 'asst', val: 0.2 },
			{ type: 'primFontSz', for: 'des', val: 24, fact: 0.5 },
			{ type: 'futureRule', val: 999 },
		];
		const evaluated = evaluateLayoutRules({}, rules, nodes);

		expect(evaluated.constraints).toMatchObject({
			sp: 0.08,
			sibSp: 0.08,
			cols: 3,
			aspectRatio: 0.3,
			dir: 'rev',
		});
		expect(evaluated.nodeConstraints.get('child')).toMatchObject({
			w: 0.3,
			primFontSz: 12,
		});
		expect(evaluated.nodeConstraints.get('assistant')).toMatchObject({
			h: 0.2,
			primFontSz: 12,
		});
		expect(rules.at(-1)).toStrictEqual({ type: 'futureRule', val: 999 });
	});

	it('applies targeted size/font rules and global direction to engine shapes', () => {
		const shapes = computeSmartArtLayout(
			{ nodes },
			{ x: 0, y: 0, width: 600, height: 300 },
			{
				algorithmType: 'lin',
				constraints: {},
				rules: [
					{ type: 'aspectRatio', val: 1 },
					{ type: 'dir', val: 1 },
					{ type: 'w', forName: 'child', val: 0.25 },
					{ type: 'h', forName: 'assistant', val: 0.2 },
					{ type: 'primFontSz', for: 'des', val: 18 },
				],
			},
		)!;

		expect(shapes.find((shape) => shape.nodeId === 'root')?.x).toBeGreaterThan(
			shapes.find((shape) => shape.nodeId === 'child')!.x,
		);
		expect(shapes.find((shape) => shape.nodeId === 'child')).toMatchObject({
			width: 150,
			fontSize: 18,
		});
		expect(shapes.find((shape) => shape.nodeId === 'assistant')).toMatchObject({
			height: 60,
			fontSize: 18,
		});
	});
});
