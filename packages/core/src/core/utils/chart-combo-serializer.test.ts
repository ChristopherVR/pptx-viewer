import { describe, it, expect } from 'vitest';

import type { PptxChartSeries, XmlObject } from '../types';
import {
	applyComboSeriesTypesToXml,
	consolidateComboContainersInXml,
} from './chart-combo-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function plotArea(): XmlObject {
	return {
		'c:layout': {},
		'c:barChart': {
			'c:barDir': { '@_val': 'col' },
			'c:grouping': { '@_val': 'clustered' },
			'c:ser': [
				{ 'c:idx': { '@_val': '0' }, 'c:tx': { 'c:v': 'A' } },
				{ 'c:idx': { '@_val': '1' }, 'c:tx': { 'c:v': 'B' } },
			],
			'c:gapWidth': { '@_val': '182' },
			'c:overlap': { '@_val': '-27' },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:catAx': { 'c:axId': { '@_val': '1' } },
		'c:valAx': { 'c:axId': { '@_val': '2' } },
	};
}

const series = (types: (string | undefined)[]): PptxChartSeries[] =>
	types.map((t, i) => ({
		name: `S${i}`,
		values: [],
		seriesChartType: t as PptxChartSeries['seriesChartType'],
	}));

/** Local names of a container's children, in emit order. */
const childLocals = (container: XmlObject): string[] => Object.keys(container).map(getLocalName);

describe('applyComboSeriesTypesToXml', () => {
	it('no-ops when all series resolve to the same type', () => {
		const pa = plotArea();
		const did = applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, undefined]),
			'bar',
			getLocalName,
		);
		expect(did).toBeFalsy();
		expect(pa['c:barChart']).toBeDefined();
		expect(pa['c:lineChart']).toBeUndefined();
	});

	it('splits into bar + line containers, preserving axes', () => {
		const pa = plotArea();
		const did = applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, 'line']),
			'bar',
			getLocalName,
		);
		expect(did).toBeTruthy();
		const bar = pa['c:barChart'] as XmlObject;
		const line = pa['c:lineChart'] as XmlObject;
		expect(bar).toBeDefined();
		expect(line).toBeDefined();
		// Series partitioned by type.
		expect((bar['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'A' });
		expect((line['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'B' });
		// Shared children (grouping, axId) reach both.
		expect(bar['c:grouping']).toBeDefined();
		expect(line['c:grouping']).toBeDefined();
		// Axes preserved.
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('keeps containers in plotArea position (before axes)', () => {
		const pa = plotArea();
		applyComboSeriesTypesToXml(pa, 'c:barChart', series([undefined, 'line']), 'bar', getLocalName);
		const keys = Object.keys(pa).map(getLocalName);
		expect(keys.indexOf('barChart')).toBeLessThan(keys.indexOf('catAx'));
		expect(keys.indexOf('lineChart')).toBeLessThan(keys.indexOf('catAx'));
	});

	it('never clones bar-only children into a line container', () => {
		// Regression: the split used to deep-clone EVERY non-ser child of the first
		// container into every sibling, so <c:lineChart> inherited c:barDir,
		// c:gapWidth and c:overlap - none of which CT_LineChart allows.
		const pa = plotArea();
		applyComboSeriesTypesToXml(pa, 'c:barChart', series([undefined, 'line']), 'bar', getLocalName);
		const line = pa['c:lineChart'] as XmlObject;
		expect(line['c:barDir']).toBeUndefined();
		expect(line['c:gapWidth']).toBeUndefined();
		expect(line['c:overlap']).toBeUndefined();
		// And the bar container keeps them.
		const bar = pa['c:barChart'] as XmlObject;
		expect(bar['c:barDir']).toBeDefined();
		expect(bar['c:gapWidth']).toBeDefined();
		expect(bar['c:overlap']).toBeDefined();
	});

	it('demotes a bar-only grouping value carried into a line container', () => {
		// ST_Grouping (line/area) has no "clustered" member; ST_BarGrouping does.
		const pa = plotArea();
		applyComboSeriesTypesToXml(pa, 'c:barChart', series([undefined, 'line']), 'bar', getLocalName);
		expect((pa['c:lineChart'] as XmlObject)['c:grouping']).toStrictEqual({ '@_val': 'standard' });
		expect((pa['c:barChart'] as XmlObject)['c:grouping']).toStrictEqual({ '@_val': 'clustered' });
	});

	it('emits each container in CT_* sequence order (c:ser before c:axId)', () => {
		const pa = plotArea();
		applyComboSeriesTypesToXml(pa, 'c:barChart', series([undefined, 'line']), 'bar', getLocalName);
		const bar = childLocals(pa['c:barChart'] as XmlObject);
		expect(bar).toStrictEqual(['barDir', 'grouping', 'ser', 'gapWidth', 'overlap', 'axId']);
		const line = childLocals(pa['c:lineChart'] as XmlObject);
		expect(line.indexOf('ser')).toBeLessThan(line.indexOf('axId'));
	});

	it('adds the required leading child when a new container type appears', () => {
		const pa = plotArea();
		applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, 'scatter']),
			'bar',
			getLocalName,
		);
		const scatter = pa['c:scatterChart'] as XmlObject;
		expect(scatter['c:scatterStyle']).toStrictEqual({ '@_val': 'lineMarker' });
		expect(childLocals(scatter)[0]).toBe('scatterStyle');
	});

	it('bails out instead of defaulting an unmappable series type to barChart', () => {
		// `waterfall` is a chartex kind with no classic c:*Chart container. The old
		// code silently emitted <c:barChart> for it.
		const pa = plotArea();
		const did = applyComboSeriesTypesToXml(
			pa,
			'c:barChart',
			series([undefined, 'waterfall']),
			'bar',
			getLocalName,
		);
		expect(did).toBeFalsy();
		expect(pa['c:barChart']).toBeDefined();
		expect(Object.keys(pa).filter((k) => getLocalName(k).endsWith('Chart'))).toStrictEqual([
			'c:barChart',
		]);
	});
});

/** A combo plotArea with two chart-type containers, each holding one series. */
function comboPlotArea(): XmlObject {
	return {
		'c:layout': {},
		'c:barChart': {
			'c:barDir': { '@_val': 'col' },
			'c:grouping': { '@_val': 'clustered' },
			'c:ser': { 'c:idx': { '@_val': '0' }, 'c:tx': { 'c:v': 'A' } },
			'c:gapWidth': { '@_val': '182' },
			'c:overlap': { '@_val': '-27' },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:lineChart': {
			'c:grouping': { '@_val': 'standard' },
			'c:ser': { 'c:idx': { '@_val': '1' }, 'c:tx': { 'c:v': 'B' } },
			'c:dropLines': { 'c:spPr': {} },
			'c:hiLowLines': {},
			'c:marker': { '@_val': '1' },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		},
		'c:catAx': { 'c:axId': { '@_val': '1' } },
		'c:valAx': { 'c:axId': { '@_val': '2' } },
	};
}

describe('consolidateComboContainersInXml', () => {
	it('returns the single container key and leaves it untouched', () => {
		const pa = plotArea();
		const result = consolidateComboContainersInXml(pa, getLocalName);
		expect(result?.primaryKey).toBe('c:barChart');
		expect(Object.keys(pa).filter((k) => getLocalName(k).endsWith('Chart'))).toHaveLength(1);
	});

	it('returns undefined when no chart-type container exists', () => {
		const pa: XmlObject = { 'c:layout': {}, 'c:catAx': {} };
		expect(consolidateComboContainersInXml(pa, getLocalName)).toBeUndefined();
	});

	it('merges multiple containers into the first, concatenating series', () => {
		const pa = comboPlotArea();
		const result = consolidateComboContainersInXml(pa, getLocalName);
		expect(result?.primaryKey).toBe('c:barChart');
		// The line container is gone.
		expect(pa['c:lineChart']).toBeUndefined();
		// The bar container now carries both series in document order.
		const sers = pa['c:barChart'] as XmlObject;
		const list = sers['c:ser'] as XmlObject[];
		expect(Array.isArray(list)).toBeTruthy();
		expect(list).toHaveLength(2);
		expect((list[0]['c:tx'] as XmlObject)['c:v']).toBe('A');
		expect((list[1]['c:tx'] as XmlObject)['c:v']).toBe('B');
		// Axes preserved.
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('captures every own non-series children of every original container', () => {
		const pa = comboPlotArea();
		const result = consolidateComboContainersInXml(pa, getLocalName)!;
		expect([...result.containerChildren.keys()]).toStrictEqual(['barChart', 'lineChart']);
		const lineLocals = result.containerChildren.get('lineChart')!.map(([k]) => getLocalName(k));
		expect(lineLocals).toStrictEqual(['grouping', 'dropLines', 'hiLowLines', 'marker', 'axId']);
	});

	it('round-trips: consolidate then re-split restores per-type containers', () => {
		const pa = comboPlotArea();
		const result = consolidateComboContainersInXml(pa, getLocalName)!;
		const did = applyComboSeriesTypesToXml(
			pa,
			result.primaryKey,
			series([undefined, 'line']),
			'bar',
			getLocalName,
			undefined,
			result.containerChildren,
		);
		expect(did).toBeTruthy();
		const bar = pa['c:barChart'] as XmlObject;
		const line = pa['c:lineChart'] as XmlObject;
		expect((bar['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'A' });
		expect((line['c:ser'] as XmlObject)['c:tx']).toStrictEqual({ 'c:v': 'B' });
	});

	it('restores the line container keeps its OWN marker / dropLines / hiLowLines', () => {
		// Regression: the re-split used to overwrite these with the bar container's
		// children, silently deleting them from the saved deck.
		const pa = comboPlotArea();
		const result = consolidateComboContainersInXml(pa, getLocalName)!;
		applyComboSeriesTypesToXml(
			pa,
			result.primaryKey,
			series([undefined, 'line']),
			'bar',
			getLocalName,
			undefined,
			result.containerChildren,
		);
		const line = pa['c:lineChart'] as XmlObject;
		expect(line['c:marker']).toStrictEqual({ '@_val': '1' });
		expect(line['c:dropLines']).toBeDefined();
		expect(line['c:hiLowLines']).toBeDefined();
		expect(line['c:grouping']).toStrictEqual({ '@_val': 'standard' });
		expect(line['c:barDir']).toBeUndefined();
		expect(line['c:gapWidth']).toBeUndefined();
		expect(line['c:overlap']).toBeUndefined();
	});
});
