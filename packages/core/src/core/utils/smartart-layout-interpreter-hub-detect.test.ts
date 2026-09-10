import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { arrangerRepeatsChildTemplate } from './smartart-layout-interpreter-hub-detect';

function arranger(forEachRawXml: Record<string, unknown> | undefined): PptxSmartArtLayoutNode {
	return {
		name: 'Name0',
		forEach: forEachRawXml
			? [{ axis: ['ch'], pointTypes: ['node'], rawXml: forEachRawXml }]
			: undefined,
	};
}

describe('arrangerRepeatsChildTemplate', () => {
	it('false when the arranger declares no forEach at all', () => {
		expect(arrangerRepeatsChildTemplate(arranger(undefined))).toBeFalsy();
	});

	it('true: a nested axis="ch" forEach (radial-cycle/basic-radial/balance shape)', () => {
		expect(
			arrangerRepeatsChildTemplate(
				arranger({
					'@_axis': 'ch',
					'dgm:layoutNode': { '@_name': 'centerShape' },
					'dgm:forEach': { '@_axis': 'ch', '@_ptType': 'node' },
				}),
			),
		).toBeTruthy();
	});

	it('true: the arranger\'s own forEach directly nests axis="self" ptType="node" (radial-cluster shape)', () => {
		expect(
			arrangerRepeatsChildTemplate(
				arranger({
					'@_axis': 'ch',
					'@_cnt': '21',
					'dgm:forEach': [
						{ '@_axis': 'self', '@_ptType': 'parTrans' },
						{ '@_axis': 'self', '@_ptType': 'node' },
					],
				}),
			),
		).toBeTruthy();
	});

	it('false: nested forEach targets sibTrans, not node points', () => {
		expect(
			arrangerRepeatsChildTemplate(
				arranger({
					'@_axis': 'ch',
					'dgm:layoutNode': { '@_name': 'item' },
					'dgm:forEach': { '@_axis': 'followSib', '@_ptType': 'sibTrans' },
				}),
			),
		).toBeFalsy();
	});

	it('false: a CONTINUATION nested forEach (st > 1, Table List)', () => {
		expect(
			arrangerRepeatsChildTemplate(
				arranger({
					'@_axis': 'ch',
					'dgm:layoutNode': { '@_name': 'roof' },
					'dgm:forEach': { '@_axis': 'ch', '@_ptType': 'node', '@_st': '2' },
				}),
			),
		).toBeFalsy();
	});

	it('false: the arranger\'s own forEach is axis="ch" but nests neither a "ch" nor a direct "self"/"node" forEach', () => {
		expect(
			arrangerRepeatsChildTemplate(
				arranger({
					'@_axis': 'ch',
					'dgm:layoutNode': { '@_name': 'item' },
				}),
			),
		).toBeFalsy();
	});
});
