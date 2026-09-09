import { describe, expect, it } from 'vitest';

import {
	resolveHubGapRatio,
	resolveHubToNodeRatio,
} from './smartart-layout-interpreter-cycle-hub-ratio';

describe('resolveHubToNodeRatio', () => {
	it('resolves an explicit `fact` ("radial-cycle": node.w = 0.7 * centerShape.w)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'node' }, [
			{
				type: 'w',
				forName: 'node',
				referenceType: 'w',
				referenceForName: 'centerShape',
				factor: 0.7,
			},
		]);
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 0.7 });
	});

	it('defaults to factor 1 when `fact` is omitted ("basic-radial": node.w = centerShape.w)', () => {
		const ratio = resolveHubToNodeRatio({ name: 'node' }, [
			{ type: 'w', forName: 'node', referenceType: 'w', referenceForName: 'centerShape' },
		]);
		expect(ratio).toStrictEqual({ hubName: 'centerShape', factor: 1 });
	});

	it('returns undefined when the ring item has no name', () => {
		expect(resolveHubToNodeRatio(undefined, [])).toBeUndefined();
		expect(resolveHubToNodeRatio({}, [])).toBeUndefined();
	});
});

describe('resolveHubGapRatio', () => {
	const hubRatio = { hubName: 'centerShape', factor: 1.25 };

	it('returns undefined without a resolved hubRatio (plain ring, no regression)', () => {
		expect(
			resolveHubGapRatio('node', undefined, [
				{ type: 'sp', referenceType: 'w', referenceForName: 'node', factor: 0.3 },
			]),
		).toBeUndefined();
	});

	it('uses `sp` directly when it references the ring item itself ("basic-radial")', () => {
		const gap = resolveHubGapRatio('node', { hubName: 'centerShape', factor: 1 }, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'node', factor: 0.3 },
		]);
		expect(gap).toBeCloseTo(0.3, 5);
	});

	it('converts `sp` by hubRatio.factor when it references the hub instead ("diverging-radial": sp fact=0.4 refForName=centerShape, hubRatio.factor=1.25 -> 0.4/1.25=0.32)', () => {
		const gap = resolveHubGapRatio('node', hubRatio, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'centerShape', factor: 0.4 },
		]);
		expect(gap).toBeCloseTo(0.32, 5);
	});

	it('returns undefined when `sp` references neither the item nor the hub (a plain ring\'s own unrelated `sp`, e.g. referencing "composite")', () => {
		const gap = resolveHubGapRatio('node', hubRatio, [
			{ type: 'sp', referenceType: 'w', referenceForName: 'composite', factor: 0.3 },
		]);
		expect(gap).toBeUndefined();
	});

	it('returns undefined when no `sp` constraint is declared at all', () => {
		expect(resolveHubGapRatio('node', hubRatio, [])).toBeUndefined();
		expect(resolveHubGapRatio('node', hubRatio, undefined)).toBeUndefined();
	});
});
