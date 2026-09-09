import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { interpretedLayoutToElements } from './smartart-interpreter-drawing-bridge';
import type { RenderedRectNode, SmartArtLayoutResult } from './smartart-layout-types';

function rect(nodeId: string, x: number): RenderedRectNode {
	return {
		kind: 'rect',
		key: nodeId,
		nodeId,
		x,
		y: 0,
		width: 100,
		height: 100,
		rx: 4,
		fill: '#fff',
		stroke: '#000',
		strokeWidth: 1,
		opacity: 1,
		text: '',
		fontSize: 10,
		textX: x + 50,
		textY: 50,
	};
}

function result(nodes: RenderedRectNode[]): SmartArtLayoutResult {
	return { nodes, connectors: [], shadowFilter: undefined, viewBox: '0 0 300 100', family: 'list' };
}

describe('interpretedLayoutToElements: descendant text folding', () => {
	it('folds an unrendered child (added via Demote/"Add Bullet") into its rendered ancestor as an extra paragraph', () => {
		// Node Two is a child of Node One in the data model but was NOT given
		// its own box (only Node One and Node Three are in `result.nodes`) -
		// exactly what `selectArrangedNodes` produces for a real `axis="ch"`
		// arranger. PowerPoint's own cached drawing folds it into Node One's
		// box as a second paragraph (`smartArtParagraphsText`'s `\n` join).
		const one: PptxSmartArtNode = { id: 'one', text: 'Node One', parentId: 'doc' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Node Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Node Three', parentId: 'doc' };
		const nodes = [one, two, three];

		const elements = interpretedLayoutToElements(
			result([rect('one', 0), rect('three', 200)]),
			nodes,
			{ x: 0, y: 0 },
		);

		expect(elements).toHaveLength(2);
		const boxOne = elements.find((el) => el.id === 'sa-interp-one');
		expect(boxOne && 'text' in boxOne ? boxOne.text : undefined).toBe('Node One\nNode Two');
		const boxThree = elements.find((el) => el.id === 'sa-interp-three');
		expect(boxThree && 'text' in boxThree ? boxThree.text : undefined).toBe('Node Three');
	});

	it('does NOT fold a child that has its own separate box (e.g. hierarchy arrangement)', () => {
		const manager: PptxSmartArtNode = { id: 'mgr', text: 'Manager', parentId: 'doc' };
		const report: PptxSmartArtNode = { id: 'rep', text: 'Report One', parentId: 'mgr' };
		const nodes = [manager, report];

		const elements = interpretedLayoutToElements(
			result([rect('mgr', 0), rect('rep', 200)]),
			nodes,
			{ x: 0, y: 0 },
		);

		const boxManager = elements.find((el) => el.id === 'sa-interp-mgr');
		expect(boxManager && 'text' in boxManager ? boxManager.text : undefined).toBe('Manager');
		const boxReport = elements.find((el) => el.id === 'sa-interp-rep');
		expect(boxReport && 'text' in boxReport ? boxReport.text : undefined).toBe('Report One');
	});

	it('skips an empty-text structural wrapper (org-chart group wrapper) without folding a blank paragraph, but still folds its own real grandchildren', () => {
		// A genuine org-chart data model inserts an empty-text group-wrapper
		// point between a manager and its reports (see
		// `fixtures/corpus/README.md`'s `rootComposite*` note); the wrapper
		// itself never gets a box, but if ITS children were also left
		// unrendered they should still surface as folded text (never silently
		// dropped), just not the wrapper's own blank line.
		const manager: PptxSmartArtNode = { id: 'mgr', text: 'Manager', parentId: 'doc' };
		const wrapper: PptxSmartArtNode = { id: 'wrap', text: '', parentId: 'mgr' };
		const extra: PptxSmartArtNode = { id: 'extra', text: 'Extra Bullet', parentId: 'wrap' };
		const nodes = [manager, wrapper, extra];

		const elements = interpretedLayoutToElements(result([rect('mgr', 0)]), nodes, { x: 0, y: 0 });

		expect(elements).toHaveLength(1);
		const boxManager = elements[0];
		expect('text' in boxManager ? boxManager.text : undefined).toBe('Manager\nExtra Bullet');
	});

	it('a node with no children projects its own text unchanged (no regression)', () => {
		const solo: PptxSmartArtNode = { id: 'solo', text: 'Solo' };
		const elements = interpretedLayoutToElements(result([rect('solo', 0)]), [solo], { x: 0, y: 0 });
		expect('text' in elements[0] ? elements[0].text : undefined).toBe('Solo');
	});
});
