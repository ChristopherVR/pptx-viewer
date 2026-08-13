import { XmlObject } from '../../types';
import type { PptxChartData } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSmartArt';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected detectChartType(plotArea: XmlObject | undefined): PptxChartData['chartType'] {
		if (!plotArea) {
			return 'unknown';
		}

		/** Map OOXML local element names to our chart type tokens. */
		const chartElementMap: Record<string, PptxChartData['chartType']> = {
			barChart: 'bar',
			bar3DChart: 'bar3D',
			lineChart: 'line',
			line3DChart: 'line3D',
			pieChart: 'pie',
			pie3DChart: 'pie3D',
			ofPieChart: 'ofPie',
			doughnutChart: 'doughnut',
			areaChart: 'area',
			area3DChart: 'area3D',
			scatterChart: 'scatter',
			bubbleChart: 'bubble',
			radarChart: 'radar',
			stockChart: 'stock',
			surfaceChart: 'surface',
			surface3DChart: 'surface',
		};

		const matchedKeys: string[] = [];

		for (const key of Object.keys(plotArea)) {
			const localName = this.compatibilityService.getXmlLocalName(key);
			const mapped = chartElementMap[localName];
			if (mapped) {
				matchedKeys.push(localName);
			}
		}

		// Multiple chart types in plotArea => combo chart
		if (matchedKeys.length >= 2) {
			return 'combo';
		}

		// Single match
		if (matchedKeys.length === 1) {
			return chartElementMap[matchedKeys[0]];
		}

		// Check for Office 2016+ chart extension types (cx:chart namespace)
		for (const key of Object.keys(plotArea)) {
			const localName = this.compatibilityService.getXmlLocalName(key);
			if (localName === 'plotAreaRegion' || localName === 'plotSurface') {
				const seriesArr = this.xmlLookupService.getChildrenArrayByLocalName(
					plotArea[key] as XmlObject | undefined,
					'series',
				);
				for (const ser of seriesArr) {
					const layoutRef = String(ser?.['@_layoutId'] || '').toLowerCase();
					const layoutPr = this.xmlLookupService.getChildByLocalName(ser, 'layoutPr');
					const hasBinning = Boolean(
						this.xmlLookupService.getChildByLocalName(layoutPr, 'binning'),
					);
					if (layoutRef.includes('waterfall')) {
						return 'waterfall';
					}
					if (layoutRef.includes('funnel')) {
						return 'funnel';
					}
					if (layoutRef.includes('treemap')) {
						return 'treemap';
					}
					if (layoutRef.includes('sunburst')) {
						return 'sunburst';
					}
					if (layoutRef.includes('boxwhisker') || layoutRef.includes('box')) {
						return 'boxWhisker';
					}
					if (
						layoutRef.includes('histogram') ||
						layoutRef.includes('pareto') ||
						(layoutRef === 'clusteredcolumn' && hasBinning)
					) {
						return 'histogram';
					}
					if (layoutRef.includes('regionmap') || layoutRef.includes('map')) {
						return 'regionMap';
					}
				}
			}
		}

		return 'unknown';
	}

	protected extractChartPointValues(
		seriesContainer: XmlObject | undefined,
		preferNumeric: boolean,
	): string[] {
		if (!seriesContainer) {
			return [];
		}
		const refName = preferNumeric ? 'numRef' : 'strRef';
		const literalName = preferNumeric ? 'numLit' : 'strLit';
		const cacheName = preferNumeric ? 'numCache' : 'strCache';

		const referenceNode =
			this.xmlLookupService.getChildByLocalName(seriesContainer, refName) ||
			this.xmlLookupService.getChildByLocalName(seriesContainer, literalName);
		const cacheNode =
			this.xmlLookupService.getChildByLocalName(referenceNode, cacheName) || referenceNode;
		const points = this.xmlLookupService.getChildrenArrayByLocalName(cacheNode, 'pt');
		if (points.length === 0) {
			return [];
		}

		return [...points]
			.sort((left, right) => {
				const leftIndex = Number.parseInt(String(left?.['@_idx'] || '0'), 10);
				const rightIndex = Number.parseInt(String(right?.['@_idx'] || '0'), 10);
				return leftIndex - rightIndex;
			})
			.map((point) =>
				String(this.xmlLookupService.getScalarChildByLocalName(point, 'v') || '').trim(),
			)
			.filter((value) => value.length > 0);
	}

	/**
	 * Extract a CATEGORY label list, expanded to its declared length.
	 *
	 * `c:strCache`/`c:numCache` is SPARSE and keyed by `@idx`: a blank category
	 * is simply a missing `c:pt`, and `c:ptCount` gives the true length. A single
	 * empty spacer cell in the source workbook therefore produces a cache with,
	 * say, `ptCount="5"` and no `idx="2"`.
	 *
	 * {@link extractChartPointValues} collapses that to a DENSE four-entry list,
	 * which is right for series names and error-bar arrays but wrong here: the
	 * value cache next to it is expanded by index
	 * (`extractSeriesNumbersWithBlanks`), so the categories came out shorter than
	 * the values. Render sizes the category axis from this array, so every point
	 * past the shortened list went unplotted and the surviving labels sat under
	 * the wrong bars - silently wrong numbers, not a visual glitch.
	 *
	 * Blank slots are kept as empty strings so index alignment survives.
	 */
	protected extractChartCategoryValues(
		categoryContainer: XmlObject | undefined,
		preferNumeric: boolean,
	): string[] {
		if (!categoryContainer) {
			return [];
		}
		const refName = preferNumeric ? 'numRef' : 'strRef';
		const literalName = preferNumeric ? 'numLit' : 'strLit';
		const cacheName = preferNumeric ? 'numCache' : 'strCache';

		const referenceNode =
			this.xmlLookupService.getChildByLocalName(categoryContainer, refName) ||
			this.xmlLookupService.getChildByLocalName(categoryContainer, literalName);
		const cacheNode =
			this.xmlLookupService.getChildByLocalName(referenceNode, cacheName) || referenceNode;
		const points = this.xmlLookupService.getChildrenArrayByLocalName(cacheNode, 'pt');
		if (points.length === 0) {
			return [];
		}

		const byIndex = new Map<number, string>();
		let maxIndex = -1;
		for (const point of points) {
			const index = Number.parseInt(String(point?.['@_idx'] ?? '0'), 10);
			if (!Number.isFinite(index) || index < 0) {
				continue;
			}
			const value = String(
				this.xmlLookupService.getScalarChildByLocalName(point, 'v') || '',
			).trim();
			if (value.length > 0) {
				byIndex.set(index, value);
			}
			if (index > maxIndex) {
				maxIndex = index;
			}
		}
		if (byIndex.size === 0) {
			return [];
		}

		const declaredCount = Number.parseInt(
			String(this.xmlLookupService.getChildByLocalName(cacheNode, 'ptCount')?.['@_val'] ?? ''),
			10,
		);
		const length =
			Number.isFinite(declaredCount) && declaredCount > maxIndex + 1 ? declaredCount : maxIndex + 1;

		const result: string[] = [];
		for (let index = 0; index < length; index++) {
			result.push(byIndex.get(index) ?? '');
		}
		return result;
	}

	protected extractChartSeriesName(seriesNode: XmlObject): string {
		const textNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'tx');
		const directText = String(
			this.xmlLookupService.getScalarChildByLocalName(textNode, 'v') || '',
		).trim();
		if (directText.length > 0) {
			return directText;
		}

		const namePoints = this.extractChartPointValues(textNode, false);
		if (namePoints.length > 0) {
			return namePoints[0];
		}
		return 'Series';
	}
}
