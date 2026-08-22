import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode } from '../types';
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import {
	applyNamedRuleOverride,
	collectNamedRules,
	resolveNamedRuleOverride,
} from './smartart-layout-interpreter-named-rules';

const nodes: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'One' },
	{ id: 'n2', text: 'Two' },
	{ id: 'n3', text: 'Three' },
];

/** A `lin` layout whose item template is named `node`, with a root ruleLst. */
function linearDefinition(
	rules: PptxSmartArtLayoutDefinition['rootNode']['rules'],
): PptxSmartArtLayoutDefinition {
	return {
		rootNode: {
			name: 'diagram',
			algorithm: { type: 'lin' },
			rules,
			children: [{ name: 'node' }],
		},
	};
}

describe('collectNamedRules', () => {
	it('gathers rules from every level of the layout tree, not just the root', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'diagram',
				rules: [{ type: 'w', forName: 'node', value: 0.5 }],
				children: [
					{
						name: 'node',
						rules: [{ type: 'primFontSz', value: 12 }],
					},
				],
			},
		};
		const rules = collectNamedRules(definition);
		expect(rules).toHaveLength(2);
		expect(rules.map((rule) => rule.type)).toStrictEqual(['w', 'primFontSz']);
	});
});

describe('resolveNamedRuleOverride', () => {
	it('resolves val/fact/max chaining for the named layoutNode only', () => {
		const rules = [
			{ type: 'w', forName: 'node', value: 0.4, factor: 1.5, max: 0.35 },
			{ type: 'primFontSz', forName: 'node', value: 28 },
			{ type: 'h', forName: 'sibTrans', value: 0.9 },
		];
		expect(resolveNamedRuleOverride(rules, 'node')).toStrictEqual({ width: 0.35, fontSize: 28 });
	});

	it('matches nothing when the name is absent from the rule pool (not everything)', () => {
		const rules = [{ type: 'w', forName: 'node', value: 0.4 }];
		expect(resolveNamedRuleOverride(rules, 'unrelated-role')).toBeUndefined();
		expect(resolveNamedRuleOverride(rules, undefined)).toBeUndefined();
	});

	it('ignores rules scoped to a different name entirely', () => {
		const rules = [{ type: 'w', forName: 'sibTrans', value: 0.1 }];
		expect(resolveNamedRuleOverride(rules, 'node')).toBeUndefined();
	});
});

describe('applyNamedRuleOverride', () => {
	it('resizes and recentres rect nodes, but only changes font size on other kinds', () => {
		const box = { width: 600, height: 300 };
		const result = {
			nodes: [
				{
					kind: 'rect' as const,
					key: 'r',
					x: 0,
					y: 0,
					width: 100,
					height: 90,
					rx: 4,
					fill: '#fff',
					stroke: 'none',
					strokeWidth: 0,
					opacity: 1,
					text: 'a',
					fontSize: 12,
					textX: 50,
					textY: 45,
				},
				{
					kind: 'circle' as const,
					key: 'c',
					cx: 10,
					cy: 10,
					r: 20,
					fill: '#fff',
					stroke: 'none',
					strokeWidth: 0,
					opacity: 1,
					text: 'b',
					fontSize: 12,
				},
			],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 600 300',
			family: 'list' as const,
		};
		const withOverride = applyNamedRuleOverride(result, { width: 0.35, fontSize: 28 }, box);
		const rect = withOverride.nodes[0];
		expect(rect.kind).toBe('rect');
		if (rect.kind === 'rect') {
			expect(rect.width).toBe(0.35 * box.width);
			expect(rect.fontSize).toBe(28);
			expect(rect.textX).toBe(rect.x + rect.width / 2);
		}
		const circle = withOverride.nodes[1];
		expect(circle.kind).toBe('circle');
		if (circle.kind === 'circle') {
			expect(circle.r).toBe(20);
			expect(circle.fontSize).toBe(28);
		}
	});

	it('is a no-op when there is no override to apply', () => {
		const result = {
			nodes: [],
			connectors: [],
			shadowFilter: undefined,
			viewBox: '0 0 1 1',
			family: 'list' as const,
		};
		expect(applyNamedRuleOverride(result, undefined, { width: 1, height: 1 })).toBe(result);
	});
});

describe('interpretSmartArtLayout: forName-scoped rule overrides', () => {
	it('overrides only the named item role, leaving other rendered fields untouched', () => {
		const definition = linearDefinition([
			{ type: 'w', forName: 'node', value: 0.4, factor: 1.5, max: 0.35 },
			{ type: 'primFontSz', forName: 'node', value: 28 },
		]);
		const result = interpretSmartArtLayout({
			layoutDefinition: definition,
			nodes,
			flat: nodes,
			box: { width: 600, height: 300 },
			palette: ['#111', '#222', '#333'],
			style: 'flat',
			elementId: 'test',
		})!;

		expect(result.nodes).toHaveLength(3);
		for (const node of result.nodes) {
			expect(node.kind).toBe('rect');
			if (node.kind === 'rect') {
				expect(node.width).toBeCloseTo(0.35 * 600);
				expect(node.fontSize).toBe(28);
			}
		}
	});

	it('does not touch geometry when the ruleLst names a role this diagram has no template for', () => {
		const definition = linearDefinition([{ type: 'w', forName: 'unused-role', value: 0.1 }]);
		const withRule = interpretSmartArtLayout({
			layoutDefinition: definition,
			nodes,
			flat: nodes,
			box: { width: 600, height: 300 },
			palette: ['#111'],
			style: 'flat',
			elementId: 'test',
		})!;
		const without = interpretSmartArtLayout({
			layoutDefinition: linearDefinition(undefined),
			nodes,
			flat: nodes,
			box: { width: 600, height: 300 },
			palette: ['#111'],
			style: 'flat',
			elementId: 'test',
		})!;
		expect(withRule.nodes).toStrictEqual(without.nodes);
	});
});
