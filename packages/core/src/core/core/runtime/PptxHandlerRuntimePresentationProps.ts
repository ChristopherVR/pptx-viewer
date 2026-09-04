import { XmlObject } from '../../types';
import type { PptxPresentationProperties, PptxChartStyle, PptxViewProperties } from '../../types';
import { parseChartDataLabelOptions } from '../../utils/chart-data-label-parser';
import { parseChartLegendEntries } from '../../utils/chart-legend-serializer';
import { parseChartTitleStyle } from '../../utils/chart-title-style-parser';
import { parseShowProperties } from './pptx-presentation-props-helpers';
import { findChildByLocalName, parsePrintProperties } from './pptx-print-properties';
import { parseViewProperties } from './pptx-view-props-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSlideMasters';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Forward declaration - implemented in PptxHandlerRuntimeTextStyleUtils.
	 * Resolves `+mj-lt` / `+mn-lt` theme font tokens to the theme typeface.
	 */
	protected resolveThemeTypeface(_typeface: string | undefined): string | undefined {
		throw new Error('resolveThemeTypeface not yet initialised');
	}

	/**
	 * Parse presentation properties from `presentationPr.xml`.
	 * Extracts show type, loop, narration, animation, and print settings.
	 */
	protected async parsePresentationProperties(): Promise<PptxPresentationProperties | undefined> {
		try {
			// First find presentationPr relationship
			const relsXml = await this.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
			if (!relsXml) {
				return undefined;
			}

			const relsData = this.parser.parse(relsXml);
			const rels = this.ensureArray(relsData?.Relationships?.Relationship);
			const prRel = rels.find(
				(r: XmlObject) =>
					String(r?.['@_Type'] || '').includes('presProps') ||
					String(r?.['@_Target'] || '').includes('presProps'),
			);

			const prTarget = prRel ? String(prRel['@_Target'] || '') : 'presProps.xml';
			const prPath = prTarget.startsWith('/') ? prTarget.substring(1) : `ppt/${prTarget}`;

			const prXmlStr = await this.zip.file(prPath)?.async('string');
			if (!prXmlStr) {
				return undefined;
			}

			const prXml = this.parser.parse(prXmlStr);
			const rootKey = Object.keys(prXml ?? {}).find(
				(key) => this.compatibilityService.getXmlLocalName(key) === 'presentationPr',
			);
			const presProps = rootKey ? (prXml[rootKey] as XmlObject | undefined) : undefined;
			if (!presProps) {
				return undefined;
			}

			const props: PptxPresentationProperties = {};

			// Show properties (p:showPr)
			const showPr = presProps['p:showPr'] as XmlObject | undefined;
			if (showPr) {
				Object.assign(
					props,
					parseShowProperties(showPr, (node) => this.parseColor(node)),
				);
			}

			// Print properties (p:prnPr)
			const prnPr = findChildByLocalName(presProps, 'prnPr');
			if (prnPr) {
				props.printProperties = parsePrintProperties(prnPr);
			}

			// Most-recently-used colours (p:clrMru)
			const clrMru = presProps['p:clrMru'] as XmlObject | undefined;
			if (clrMru) {
				const colorNodes = this.ensureArray(clrMru['a:srgbClr']);
				const mruColors = colorNodes
					.map((c: XmlObject) => {
						const val = String(c?.['@_val'] || '').trim();
						return val.length > 0 ? `#${val}` : '';
					})
					.filter((c: string) => c.length > 0);
				if (mruColors.length > 0) {
					props.mruColors = mruColors;
				}
			}

			// NOTE: `p:gridSpacing` does NOT live under `p:presentationPr` in real
			// PowerPoint files; it lives under `p:viewPr` in `ppt/viewProps.xml`.
			// It used to be (incorrectly) read here, which meant this field was
			// always `undefined` for real decks. See `parseViewProperties` below
			// and `pptx-view-props-helpers.ts` for the correct read; consumers
			// must use `PptxData.viewProperties.gridSpacing`.

			return props;
		} catch (e) {
			console.warn('Failed to parse presentation properties:', e);
			return undefined;
		}
	}

	/**
	 * Parse view properties from `ppt/viewProps.xml`.
	 */
	protected async parseViewProperties(): Promise<PptxViewProperties | undefined> {
		try {
			const viewPropsXml = await this.zip.file('ppt/viewProps.xml')?.async('string');
			if (!viewPropsXml) {
				return undefined;
			}

			const data = this.parser.parse(viewPropsXml) as XmlObject;
			const rootKey = Object.keys(data ?? {}).find((key) => key.replace(/^.*:/u, '') === 'viewPr');
			const viewPrRoot = (rootKey ? data[rootKey] : undefined) as XmlObject | undefined;
			if (!viewPrRoot) {
				return undefined;
			}

			return parseViewProperties(viewPrRoot);
		} catch (e) {
			console.warn('Failed to parse view properties:', e);
			return undefined;
		}
	}

	/**
	 * Resolve the `c:spPr` fill of a chart container (`c:chartSpace` or
	 * `c:plotArea`) to a colour string, or the literal `'none'` for
	 * `<a:noFill/>`. Returns `undefined` when the container declares no fill at
	 * all, which leaves the choice to the renderer.
	 *
	 * `<a:noFill/>` parses to the empty STRING, so presence - not truthiness -
	 * has to decide.
	 */
	private parseChartContainerFill(container: XmlObject | undefined): string | undefined {
		const shapeProperties = this.xmlLookupService.getChildByLocalName(container, 'spPr');
		if (!shapeProperties) {
			return undefined;
		}
		// `getChildByLocalName` returns undefined for non-object values, and
		// `<a:noFill/>` parses to the empty STRING, so presence has to be checked
		// against the keys directly.
		const hasNoFill = Object.keys(shapeProperties).some(
			(key) => this.compatibilityService.getXmlLocalName(key) === 'noFill',
		);
		if (hasNoFill) {
			return 'none';
		}
		const solidFill = this.xmlLookupService.getChildByLocalName(shapeProperties, 'solidFill');
		return solidFill ? this.parseColor(solidFill) : undefined;
	}

	/**
	 * Extract chart style metadata from chart XML.
	 */
	protected extractChartStyle(
		chartSpace: XmlObject | undefined,
		chartRoot: XmlObject | undefined,
	): PptxChartStyle | undefined {
		if (!chartSpace && !chartRoot) {
			return undefined;
		}
		const style: PptxChartStyle = {};
		let hasStyle = false;

		// Style ID from c:style
		const styleNode = this.xmlLookupService.getChildByLocalName(chartSpace, 'style');
		if (styleNode?.['@_val']) {
			style.styleId = parseInt(String(styleNode['@_val']));
			hasStyle = true;
		}

		// Chart-area fill (`c:chartSpace/c:spPr`). `<a:noFill/>` is the common
		// case and means the chart floats on the slide background; recording it as
		// `'none'` stops renderers painting their own panel behind it.
		const chartAreaFill = this.parseChartContainerFill(chartSpace);
		if (chartAreaFill) {
			style.chartAreaFill = chartAreaFill;
			hasStyle = true;
		}

		if (chartRoot) {
			// Legend
			const legend = this.xmlLookupService.getChildByLocalName(chartRoot, 'legend');
			if (legend) {
				style.hasLegend = true;
				hasStyle = true;
				// Classic charts nest position in a child (`c:legend/c:legendPos/@val`);
				// ChartEx (`cx:`) charts put it directly on the element
				// (`cx:legend/@pos`). Fall back to the attribute when the child lookup
				// misses so a `cx:legend pos="t"` isn't silently ignored (it used to
				// always fall through to renderers' `?? 'b'` default).
				const legendPos = this.xmlLookupService.getChildByLocalName(legend, 'legendPos');
				const legendPosVal = legendPos?.['@_val'] ?? legend['@_pos'];
				if (legendPosVal) {
					style.legendPosition = String(legendPosVal);
				}
				const entries = parseChartLegendEntries(
					legend,
					(key) => this.compatibilityService.getXmlLocalName(key),
					(node) => this.parseColor(node),
					(raw) => this.resolveThemeTypeface(raw) ?? raw,
				);
				if (entries.length > 0) {
					style.legendEntries = entries;
				}
			}

			// Title
			const title = this.xmlLookupService.getChildByLocalName(chartRoot, 'title');
			if (title) {
				style.hasTitle = true;
				hasStyle = true;
				Object.assign(
					style,
					parseChartTitleStyle(
						title,
						this.xmlLookupService,
						{ parseColor: (node, placeholder) => this.parseColor(node, placeholder) },
						(raw) => this.resolveThemeTypeface(raw) ?? raw,
					),
				);
			}

			// Plot area gridlines
			const plotArea = this.xmlLookupService.getChildByLocalName(chartRoot, 'plotArea');
			if (plotArea) {
				const plotAreaFill = this.parseChartContainerFill(plotArea);
				if (plotAreaFill) {
					style.plotAreaFill = plotAreaFill;
					hasStyle = true;
				}
				const valAx = this.xmlLookupService.getChildByLocalName(plotArea, 'valAx');
				if (valAx) {
					const majorGridlines = this.xmlLookupService.getChildByLocalName(valAx, 'majorGridlines');
					if (majorGridlines) {
						style.hasGridlines = true;
						hasStyle = true;
					}
				}

				// Data labels check across chart types
				const chartTypeKeys = Object.keys(plotArea).filter((key) =>
					this.compatibilityService.getXmlLocalName(key).endsWith('Chart'),
				);
				for (const ctKey of chartTypeKeys) {
					const ctNode = plotArea[ctKey] as XmlObject | undefined;
					if (!ctNode) {
						continue;
					}

					// Check chart-level dLbls (applies to all series)
					const chartDLbls = this.xmlLookupService.getChildByLocalName(ctNode, 'dLbls');
					if (chartDLbls && !style.dataLabels) {
						const deleted = this.xmlLookupService.getChildByLocalName(chartDLbls, 'delete');
						style.hasDataLabels = !(deleted?.['@_val'] === '1' || deleted?.['@_val'] === 'true');
						style.dataLabels = parseChartDataLabelOptions(chartDLbls, this.xmlLookupService);
						hasStyle = true;
					}

					// Also check per-series dLbls
					if (!style.hasDataLabels) {
						const seriesList = this.xmlLookupService.getChildrenArrayByLocalName(ctNode, 'ser');
						for (const ser of seriesList) {
							const dLbls = this.xmlLookupService.getChildByLocalName(ser, 'dLbls');
							if (dLbls) {
								const showVal = this.xmlLookupService.getChildByLocalName(dLbls, 'showVal');
								if (showVal?.['@_val'] === '1') {
									style.hasDataLabels = true;
									hasStyle = true;
								}
							}
						}
					}
				}
			}
		}

		return hasStyle ? style : undefined;
	}

	protected toPresentationTarget(slidePath: string): string {
		const normalized = slidePath.startsWith('/') ? slidePath.substring(1) : slidePath;
		return normalized.startsWith('ppt/') ? normalized.substring(4) : normalized;
	}

	protected toSlidePathFromTarget(target: string): string {
		const normalized = target.startsWith('/') ? target.substring(1) : target;
		return normalized.startsWith('ppt/') ? normalized : `ppt/${normalized}`;
	}

	protected toSlideRelsPath(slidePath: string): string {
		return `${slidePath.replace('slides/', 'slides/_rels/')}.rels`;
	}
}
