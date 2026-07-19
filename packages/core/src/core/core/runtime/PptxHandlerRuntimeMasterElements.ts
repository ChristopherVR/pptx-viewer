import {
	XmlObject,
	PlaceholderTextLevelStyle,
	PptxElement,
	PptxSlideMaster,
	PptxMasterTextStyles,
	PptxTextStyleLevels,
	PptxHeaderFooterFlags,
} from '../../types';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimePlaceholderDefaults';
import type { PlaceholderInfo } from './PptxHandlerRuntimeTypes';

export function parseHeaderFooterFlags(
	hf: XmlObject | undefined,
): PptxHeaderFooterFlags | undefined {
	if (!hf) {
		return undefined;
	}
	const result: PptxHeaderFooterFlags = {};
	if (hf['@_hdr'] !== undefined) {
		result.hasHeader = String(hf['@_hdr']) !== '0';
	}
	if (hf['@_ftr'] !== undefined) {
		result.hasFooter = String(hf['@_ftr']) !== '0';
	}
	if (hf['@_dt'] !== undefined) {
		result.hasDateTime = String(hf['@_dt']) !== '0';
	}
	if (hf['@_sldNum'] !== undefined) {
		result.hasSlideNumber = String(hf['@_sldNum']) !== '0';
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse a `CT_TextListStyle` node (`a:defPPr` + `a:lvl1pPr` … `a:lvl9pPr`)
	 * into a level-keyed style map. Used for `<p:txStyles>` children
	 * (`p:titleStyle`, `p:bodyStyle`, `p:otherStyle`) — see ECMA-376 §19.3.1.52.
	 */
	protected parseTextListStyle(node: XmlObject | undefined): PptxTextStyleLevels | undefined {
		if (!node) {
			return undefined;
		}
		const levels: Record<number, PlaceholderTextLevelStyle> = {};
		const defParsed = this.parsePlaceholderLevelStyle(node['a:defPPr'] as XmlObject | undefined);
		if (defParsed) {
			levels[-1] = defParsed;
		}
		for (let lvl = 1; lvl <= 9; lvl++) {
			const parsed = this.parsePlaceholderLevelStyle(
				node[`a:lvl${lvl}pPr`] as XmlObject | undefined,
			);
			if (parsed) {
				levels[lvl - 1] = parsed;
			}
		}
		return Object.keys(levels).length > 0 ? levels : undefined;
	}

	/**
	 * Parse `<p:txStyles>` from a slide-master XML object into a structured
	 * {@link PptxMasterTextStyles}. Used to populate `PptxSlideMaster.txStyles`
	 * so the title/body/other text-style cascade (P-H1) is visible on the
	 * typed model.
	 */
	protected parseMasterTxStyles(
		masterXml: XmlObject | undefined,
	): PptxMasterTextStyles | undefined {
		const txStyles = masterXml?.['p:txStyles'] as XmlObject | undefined;
		if (!txStyles) {
			return undefined;
		}
		const titleStyle = this.parseTextListStyle(txStyles['p:titleStyle'] as XmlObject | undefined);
		const bodyStyle = this.parseTextListStyle(txStyles['p:bodyStyle'] as XmlObject | undefined);
		const otherStyle = this.parseTextListStyle(txStyles['p:otherStyle'] as XmlObject | undefined);
		if (!titleStyle && !bodyStyle && !otherStyle) {
			return undefined;
		}
		const result: PptxMasterTextStyles = {};
		if (titleStyle) {
			result.titleStyle = titleStyle;
		}
		if (bodyStyle) {
			result.bodyStyle = bodyStyle;
		}
		if (otherStyle) {
			result.otherStyle = otherStyle;
		}
		return result;
	}

	/**
	 * Enrich an array of {@link PptxSlideMaster} entries (already produced by
	 * `parseSlideMasters`) with parsed `<p:txStyles>`. Loads each master's XML
	 * once, parses, and caches it in `masterXmlMap` for downstream consumers.
	 *
	 * Also stores the parsed result on the per-master cache so that the
	 * inheritance chain in `applyMasterTextStyleCascade` can find it without
	 * re-parsing.
	 */
	protected async enrichSlideMastersWithTxStyles(slideMasters: PptxSlideMaster[]): Promise<void> {
		for (const master of slideMasters) {
			try {
				let masterXmlObj = this.masterXmlMap.get(master.path);
				if (!masterXmlObj) {
					const xmlStr = await this.zip.file(master.path)?.async('string');
					if (!xmlStr) {
						continue;
					}
					masterXmlObj = this.parser.parse(xmlStr) as XmlObject;
					this.masterXmlMap.set(master.path, masterXmlObj);
				}
				const sldMaster = masterXmlObj['p:sldMaster'] as XmlObject | undefined;
				if (!sldMaster) {
					continue;
				}
				const parsed = this.parseMasterTxStyles(sldMaster);
				if (parsed) {
					master.txStyles = parsed;
					this.masterTxStylesCache.set(master.path, parsed);
				}
				const hf = parseHeaderFooterFlags(sldMaster['p:hf'] as XmlObject | undefined);
				if (hf) {
					master.headerFooter = hf;
				}
			} catch (e) {
				console.warn('Failed to parse master txStyles:', e);
			}
		}
	}

	protected parsePresentationDefaultTextStyle(): void {
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const defaultTextStyle = presentation?.['p:defaultTextStyle'] as XmlObject | undefined;
		if (!defaultTextStyle) {
			this.presentationDefaultTextStyle = undefined;
			return;
		}

		const levelStyles: Record<number, PlaceholderTextLevelStyle> = {};
		for (let level = 1; level <= 9; level++) {
			const parsed = this.parsePlaceholderLevelStyle(
				defaultTextStyle[`a:lvl${level}pPr`] as XmlObject | undefined,
			);
			if (parsed) {
				levelStyles[level - 1] = parsed;
			}
		}

		const defaultLevel = this.parsePlaceholderLevelStyle(
			defaultTextStyle['a:defPPr'] as XmlObject | undefined,
		);
		if (defaultLevel) {
			levelStyles[-1] = defaultLevel;
		}

		this.presentationDefaultTextStyle =
			Object.keys(levelStyles).length > 0
				? {
						type: 'body',
						levelStyles,
					}
				: undefined;
	}

	protected async getMasterElements(layoutPath: string): Promise<PptxElement[]> {
		// Get the layout's relationship file to find the master
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return [];
		}

		let masterPath: string | undefined;
		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				masterPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
				break;
			}
		}

		if (!masterPath) {
			return [];
		}

		// Check cache first
		if (this.masterCache.has(masterPath)) {
			return this.masterCache.get(masterPath)!;
		}

		// Namespace generated element IDs with the owning master part so that
		// e.g. slideMaster1's first picture doesn't collide with slideMaster2's
		// (indexInType is only unique within a single master's own spTree).
		const masterToken =
			masterPath
				.split('/')
				.pop()
				?.replace(/\.xml$/u, '') ?? masterPath;

		try {
			const masterXmlStr = await this.zip.file(masterPath)?.async('string');
			if (!masterXmlStr) {
				return [];
			}

			const masterXmlObj = this.parser.parse(masterXmlStr);
			this.masterXmlMap.set(masterPath, masterXmlObj as XmlObject);

			// Load master relationships
			const masterRelsPath = `${masterPath.replace('slideMasters/', 'slideMasters/_rels/')}.rels`;
			await this.loadSlideRelationships(masterPath, masterRelsPath);

			const spTree = masterXmlObj['p:sldMaster']?.['p:cSld']?.['p:spTree'];
			if (!spTree) {
				this.masterCache.set(masterPath, []);
				return [];
			}

			// Unwrap mc:AlternateContent blocks before accessing element arrays
			this.unwrapAlternateContent(spTree as Record<string, unknown>);

			// First pass: extract placeholder defaults from shapes
			const shapes = this.ensureArray(spTree['p:sp']);
			const placeholderShapeIndices = new Set<number>();
			for (let idx = 0; idx < shapes.length; idx++) {
				const shape = shapes[idx];
				const nvSpPr = shape['p:nvSpPr'] as XmlObject | undefined;
				const ph = (nvSpPr?.['p:nvPr'] as XmlObject | undefined)?.['p:ph'];
				if (ph) {
					placeholderShapeIndices.add(idx);
					const phDefaults = this.extractPlaceholderDefaultsFromShape(shape as XmlObject);
					if (phDefaults) {
						if (!this.masterPlaceholderDefaultsCache.has(masterPath)) {
							this.masterPlaceholderDefaultsCache.set(masterPath, new Map());
						}
						const phInfo: PlaceholderInfo = {
							type: phDefaults.type,
							idx: phDefaults.idx !== undefined ? String(phDefaults.idx) : undefined,
						};
						const key = this.buildPlaceholderDefaultsKey(phInfo);
						this.masterPlaceholderDefaultsCache.get(masterPath)!.set(key, phDefaults);
					}
				}
			}

			// Parse elements in document order (preserving z-order)
			const childOrder = this.extractSpTreeChildOrder(
				masterXmlStr,
				spTree as Record<string, unknown>,
				'p:spTree',
			);
			const elements: PptxElement[] = [];

			for (const entry of childOrder) {
				if (entry.tag === 'p:sp') {
					// Skip placeholder shapes
					if (placeholderShapeIndices.has(entry.indexInType)) {
						continue;
					}
					const shape = shapes[entry.indexInType];
					if (!shape) {
						continue;
					}

					const spPr = shape['p:spPr'] as XmlObject | undefined;
					let element: PptxElement | null = null;

					if (spPr?.['a:blipFill']) {
						element = await this.parseShapeWithImageFill(
							shape,
							`master-shape-img-${masterToken}-${entry.indexInType}`,
							masterPath,
						);
					} else {
						element = this.parseShape(
							shape,
							`master-shape-${masterToken}-${entry.indexInType}`,
							masterPath,
						);
					}

					if (element) {
						element.id = `master-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:pic') {
					const pics = this.ensureArray(spTree['p:pic']);
					const pic = pics[entry.indexInType];
					if (!pic) {
						continue;
					}
					const element = await this.parsePicture(
						pic,
						`master-pic-${masterToken}-${entry.indexInType}`,
						masterPath,
					);
					if (element) {
						element.id = `master-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:graphicFrame') {
					const frames = this.ensureArray(spTree['p:graphicFrame']);
					const frame = frames[entry.indexInType];
					if (!frame) {
						continue;
					}
					const element = this.parseGraphicFrame(
						frame,
						`master-frame-${masterToken}-${entry.indexInType}`,
						masterPath,
					);
					if (element) {
						element.id = `master-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:cxnSp') {
					const connectors = this.ensureArray(spTree['p:cxnSp']);
					const connector = connectors[entry.indexInType] as XmlObject | undefined;
					if (!connector) {
						continue;
					}
					const element = this.parseConnector(
						connector,
						`master-conn-${masterToken}-${entry.indexInType}`,
						masterPath,
					);
					if (element) {
						element.id = `master-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:grpSp') {
					// Master background artwork is frequently wrapped in a
					// top-level group; parse it like slide groups so themed
					// backgrounds drawn on the master render on slides.
					const groups = this.ensureArray(spTree['p:grpSp']);
					const group = groups[entry.indexInType] as XmlObject | undefined;
					if (!group) {
						continue;
					}
					const element = await this.parseGroupShapeAsGroup(
						group,
						`master-group-${masterToken}-${entry.indexInType}`,
						masterPath,
					);
					if (element) {
						element.id = `master-${element.id}`;
						elements.push(element);
					}
				}
				// Other element types (p:contentPart) are uncommon in masters
				// but could be added here if needed.
			}

			this.masterCache.set(masterPath, elements);
			return elements;
		} catch (e) {
			console.warn('Failed to parse master:', e);
			return [];
		}
	}
}
