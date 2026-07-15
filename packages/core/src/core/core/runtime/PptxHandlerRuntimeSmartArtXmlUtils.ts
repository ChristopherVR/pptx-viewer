import { XmlObject } from '../../types';
import type {
	PptxSmartArtChrome,
	PptxSmartArtColorTransform,
	PptxSmartArtNodeStyle,
	PptxSmartArtTextRun,
} from '../../types';
import {
	parseSmartArtColorStyleLabels,
	parseSmartArtDefinitionMetadata,
} from '../../utils/smartart-definition-metadata';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeComments';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async readXmlPartByRelationshipId(
		slidePath: string,
		relationshipId: string,
	): Promise<{ xml: XmlObject; partPath: string } | undefined> {
		const normalizedRelationshipId = String(relationshipId || '').trim();
		if (normalizedRelationshipId.length === 0) {
			return undefined;
		}

		const relationships = this.slideRelsMap.get(slidePath);
		const target = relationships?.get(normalizedRelationshipId);
		if (!target) {
			return undefined;
		}

		const partPath = this.resolveImagePath(slidePath, target);
		const xmlString = await this.zip.file(partPath)?.async('string');
		if (!xmlString) {
			return undefined;
		}

		return {
			xml: this.parser.parse(xmlString) as XmlObject,
			partPath,
		};
	}

	protected collectLocalTextValues(node: unknown, localName: string, output: string[]): void {
		// Load H1: iterative explicit-stack walk to bound stack usage on
		// deeply-nested attacker-supplied SmartArt XML (was recursive).
		const MAX_NODES = 1_000_000;
		const stack: unknown[] = [node];
		let visited = 0;
		while (stack.length > 0) {
			if (visited++ > MAX_NODES) {
				break;
			}
			const current = stack.pop();
			if (current === null || current === undefined) {
				continue;
			}
			if (Array.isArray(current)) {
				for (const entry of current) {
					stack.push(entry);
				}
				continue;
			}
			if (typeof current !== 'object') {
				continue;
			}
			const objectNode = current as XmlObject;
			for (const [key, value] of Object.entries(objectNode)) {
				if (this.compatibilityService.getXmlLocalName(key) === localName) {
					if (typeof value === 'string' || typeof value === 'number') {
						const textValue = String(value).trim();
						if (textValue.length > 0) {
							output.push(textValue);
						}
						continue;
					}
				}
				if (value !== null && value !== undefined) {
					stack.push(value);
				}
			}
		}
	}

	/**
	 * Extract the per-run text + run-properties of a SmartArt content point's
	 * first paragraph (`dgm:t/a:p/a:r`).
	 *
	 * Each `a:r` yields one {@link PptxSmartArtTextRun} carrying its joined
	 * `a:t` text and a verbatim copy of its `a:rPr` properties (when present).
	 * Only the first paragraph is captured: SmartArt content points are
	 * single-paragraph in practice, and the round-trip save path rebuilds a
	 * single paragraph from these runs. Returns undefined when there is fewer
	 * than one run worth preserving (a single run is still returned so per-run
	 * formatting like a bold sole run survives).
	 */
	protected extractSmartArtNodeRuns(point: XmlObject): PptxSmartArtTextRun[] | undefined {
		const tBody = this.xmlLookupService.getChildByLocalName(point, 't');
		if (!tBody) {
			return undefined;
		}
		const paragraph = this.xmlLookupService.getChildrenArrayByLocalName(tBody, 'p')[0];
		if (!paragraph) {
			return undefined;
		}
		const runNodes = this.xmlLookupService.getChildrenArrayByLocalName(paragraph, 'r');
		if (runNodes.length === 0) {
			return undefined;
		}

		const runs: PptxSmartArtTextRun[] = [];
		for (const run of runNodes) {
			const textValues: string[] = [];
			this.collectLocalTextValues(run, 't', textValues);
			const text = textValues.join('');
			const rPrNode = this.xmlLookupService.getChildByLocalName(run, 'rPr');
			const entry: PptxSmartArtTextRun = { text };
			if (rPrNode) {
				// Deep clone so later in-memory edits cannot mutate the parsed tree.
				entry.rPr = JSON.parse(JSON.stringify(rPrNode)) as Record<string, unknown>;
			}
			runs.push(entry);
		}

		return runs.length > 0 ? runs : undefined;
	}

	/**
	 * Extract a content point's per-node visual override.
	 *
	 * Reads the point's presentation `spPr` solid fill and line colour, and the
	 * first run's `rPr` bold / italic / solid fill, into a
	 * {@link PptxSmartArtNodeStyle}. Every field is optional and only set when
	 * present, so an unstyled point yields `undefined` (never throws on missing
	 * structure). This lets the editing UI display the node's current colours.
	 */
	protected extractSmartArtNodeStyle(point: XmlObject): PptxSmartArtNodeStyle | undefined {
		const style: PptxSmartArtNodeStyle = {};

		const spPr = this.xmlLookupService.getChildByLocalName(point, 'spPr');
		if (spPr) {
			const fill = this.parseColor(this.xmlLookupService.getChildByLocalName(spPr, 'solidFill'));
			if (fill) {
				style.fillColor = fill;
			}
			const ln = this.xmlLookupService.getChildByLocalName(spPr, 'ln');
			if (ln) {
				const lineColor = this.parseColor(
					this.xmlLookupService.getChildByLocalName(ln, 'solidFill'),
				);
				if (lineColor) {
					style.lineColor = lineColor;
				}
			}
		}

		const rPr = this.firstRunProperties(point);
		if (rPr) {
			if (this.xmlBoolean(rPr['@_b'])) {
				style.bold = true;
			}
			if (this.xmlBoolean(rPr['@_i'])) {
				style.italic = true;
			}
			const fontColor = this.parseColor(
				this.xmlLookupService.getChildByLocalName(rPr, 'solidFill'),
			);
			if (fontColor) {
				style.fontColor = fontColor;
			}
		}

		return Object.keys(style).length > 0 ? style : undefined;
	}

	/** Read the first run's `rPr` of a content point's first paragraph. */
	private firstRunProperties(point: XmlObject): XmlObject | undefined {
		const tBody = this.xmlLookupService.getChildByLocalName(point, 't');
		if (!tBody) {
			return undefined;
		}
		const paragraph = this.xmlLookupService.getChildrenArrayByLocalName(tBody, 'p')[0];
		if (!paragraph) {
			return undefined;
		}
		const run = this.xmlLookupService.getChildrenArrayByLocalName(paragraph, 'r')[0];
		if (!run) {
			return undefined;
		}
		return this.xmlLookupService.getChildByLocalName(run, 'rPr');
	}

	/** Interpret an OOXML boolean attribute ("1"/"true"/"on" => true). */
	private xmlBoolean(value: unknown): boolean {
		const v = String(value ?? '')
			.trim()
			.toLowerCase();
		return v === '1' || v === 'true' || v === 'on';
	}

	/**
	 * Parse background and outline chrome from `dgm:bg` and `dgm:whole`.
	 */
	protected parseSmartArtChrome(dataModel: XmlObject | undefined): PptxSmartArtChrome | undefined {
		if (!dataModel) {
			return undefined;
		}

		const bg = this.xmlLookupService.getChildByLocalName(dataModel, 'bg');
		const whole = this.xmlLookupService.getChildByLocalName(dataModel, 'whole');
		if (!bg && !whole) {
			return undefined;
		}

		const chrome: PptxSmartArtChrome = {};

		if (bg) {
			const solidFill = this.xmlLookupService.getChildByLocalName(bg, 'solidFill');
			const bgColor = this.parseColor(solidFill);
			if (bgColor) {
				chrome.backgroundColor = bgColor;
			}
		}

		if (whole) {
			const lnNode = this.xmlLookupService.getChildByLocalName(whole, 'ln');
			if (lnNode) {
				const solidFill = this.xmlLookupService.getChildByLocalName(lnNode, 'solidFill');
				const outlineColor = this.parseColor(solidFill);
				if (outlineColor) {
					chrome.outlineColor = outlineColor;
				}
				const widthRaw = parseInt(String(lnNode['@_w'] || ''), 10);
				if (Number.isFinite(widthRaw) && widthRaw > 0) {
					chrome.outlineWidth = widthRaw / 12700; // EMU to pt
				}
			}
		}

		return chrome.backgroundColor || chrome.outlineColor ? chrome : undefined;
	}

	/**
	 * Parse colour transform from `ppt/diagrams/colors*.xml`.
	 */
	protected parseSmartArtColorTransform(
		slidePath: string,
		colorsRelId: string,
	): Promise<PptxSmartArtColorTransform | undefined> {
		return this.parseSmartArtColorTransformImpl(slidePath, colorsRelId);
	}

	private async parseSmartArtColorTransformImpl(
		slidePath: string,
		colorsRelId: string,
	): Promise<PptxSmartArtColorTransform | undefined> {
		if (colorsRelId.length === 0) {
			return undefined;
		}

		try {
			const colorsPart = await this.readXmlPartByRelationshipId(slidePath, colorsRelId);
			if (!colorsPart) {
				return undefined;
			}

			const colorsDef = this.xmlLookupService.getChildByLocalName(colorsPart.xml, 'colorsDef');
			if (!colorsDef) {
				return undefined;
			}

			const localName = (key: string) => this.compatibilityService.getXmlLocalName(key);
			const metadata = parseSmartArtDefinitionMetadata(colorsDef, localName);
			const labels = parseSmartArtColorStyleLabels(colorsDef, localName);
			const name =
				metadata.titles?.[0]?.value ||
				String(colorsDef['@_title'] || colorsDef['@_uniqueId'] || '').trim() ||
				undefined;
			const fillColors: string[] = [];
			const lineColors: string[] = [];

			const styleLbls = this.xmlLookupService.getChildrenArrayByLocalName(colorsDef, 'styleLbl');
			for (const lbl of styleLbls) {
				const fillClrLst = this.xmlLookupService.getChildByLocalName(lbl, 'fillClrLst');
				const linClrLst = this.xmlLookupService.getChildByLocalName(lbl, 'linClrLst');

				if (fillClrLst) {
					const color =
						this.parseColor(fillClrLst) ??
						this.resolveSmartArtSchemeColor(
							this.xmlLookupService.getChildByLocalName(fillClrLst, 'schemeClr'),
						);
					if (color) {
						fillColors.push(color);
					}
				}

				if (linClrLst) {
					const color =
						this.parseColor(linClrLst) ??
						this.resolveSmartArtSchemeColor(
							this.xmlLookupService.getChildByLocalName(linClrLst, 'schemeClr'),
						);
					if (color) {
						lineColors.push(color);
					}
				}
			}

			if (fillColors.length === 0 && lineColors.length === 0) {
				return undefined;
			}

			return { ...metadata, name, fillColors, lineColors, labels };
		} catch {
			return undefined;
		}
	}

	/**
	 * Resolve a scheme colour reference to a hex value using the theme colour map.
	 */
	protected resolveSmartArtSchemeColor(schemeClr: XmlObject | undefined): string | undefined {
		if (!schemeClr) {
			return undefined;
		}
		const val = String(schemeClr['@_val'] || '').trim();
		if (val.length === 0) {
			return undefined;
		}
		const mapped = this.themeColorMap[val];
		if (mapped) {
			return mapped.startsWith('#') ? mapped : `#${mapped}`;
		}
		return undefined;
	}
}
