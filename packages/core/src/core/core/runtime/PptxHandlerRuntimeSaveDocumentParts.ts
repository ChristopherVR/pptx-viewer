import { XmlObject, PptxElement } from '../../types';
import type {
	SmartArtPptxElement,
	PptxEmbeddedFont,
	PptxEmbeddedFontList,
	PptxNotesMaster,
	PptxHandoutMaster,
	PptxTagCollection,
	PptxCustomerData,
	PptxSlide,
} from '../../types';
import { applySmartArtLayoutDefinition, convertXmlToStrict, decomposeSmartArt } from '../../utils';
import { writeCustomerDataScopes } from '../../utils/customer-data-package';
import type { CustomerDataScope } from '../../utils/customer-data-package';
import { serializeEmbeddedFontList, setEmbeddedFontList } from '../../utils/embedded-font-list';
import { obfuscateFont, generateFontGuid } from '../../utils/font-deobfuscation';
import { safeResolveZipPath } from '../../utils/safe-path';
import { writeTagCollections } from '../../utils/tag-package';
import type { PptxSaveFormat } from '../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveDataSerialization';
import { applySmartArtColorTransform } from './smartart-colors-builder';
import {
	buildFabricatedDrawingXml,
	smartArtElementsToDrawingShapes,
} from './smartart-fabrication-drawing';
import { synthesizeNewSmartArtStructuralPoints } from './smartart-node-synthesis';
import { applySmartArtQuickStyle } from './smartart-quick-style-builder';
import { applySmartArtChrome } from './smartart-save-chrome';
import {
	applySmartArtLayoutIdentity,
	presentationIdsFromPoints,
	resolveSmartArtSaveLayout,
} from './smartart-save-geometry';
import { mergeSmartArtPointXml, mergeSmartArtConnectionXml } from './smartart-xml-builders';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Pending SmartArt data updates to process during save. */
	protected pendingSmartArtUpdates?: Array<{
		element: SmartArtPptxElement;
		slidePath: string;
	}>;

	/**
	 * Collect SmartArt data for deferred async processing during save.
	 */
	protected serializeSmartArtDataToXml(element: SmartArtPptxElement, slidePath: string): void {
		if (!element.smartArtData?.dataRelId) {
			return;
		}
		if (!this.pendingSmartArtUpdates) {
			this.pendingSmartArtUpdates = [];
		}
		this.pendingSmartArtUpdates.push({ element, slidePath });
	}

	/**
	 * Process all pending SmartArt data updates by writing modified
	 * `dgm:dataModel` back to the diagram data XML parts.
	 */
	protected async processPendingSmartArtUpdates(): Promise<void> {
		if (!this.pendingSmartArtUpdates || this.pendingSmartArtUpdates.length === 0) {
			return;
		}

		for (const { element, slidePath: capturedSlidePath } of this.pendingSmartArtUpdates) {
			const smartArtData = element.smartArtData;
			if (!smartArtData?.dataRelId) {
				continue;
			}

			// Use the slide path captured when the update was queued. The element
			// already knows which slide it lives on; recomputing via
			// findSlidePathForElement (a heuristic that returns the first slide)
			// would corrupt diagrams on any slide but the first. Fall back to the
			// heuristic only when no path was captured.
			const slidePath =
				capturedSlidePath && capturedSlidePath.length > 0
					? capturedSlidePath
					: this.findSlidePathForElement(element);
			if (!slidePath) {
				continue;
			}

			const relationships = this.slideRelsMap.get(slidePath);
			const dataTarget = relationships?.get(smartArtData.dataRelId);
			if (!dataTarget) {
				continue;
			}

			const dataPartPath = this.resolveImagePath(slidePath, dataTarget);
			const existingXml = await this.zip.file(dataPartPath)?.async('string');
			if (!existingXml) {
				continue;
			}

			try {
				const parsed = this.parser.parse(existingXml) as XmlObject;
				const dataModel = this.xmlLookupService.getChildByLocalName(parsed, 'dataModel');
				if (!dataModel) {
					continue;
				}

				// Resolve both lists up front: grafting structural scaffolding for a
				// brand-new node (see below) needs the point AND connection lists
				// together, not one at a time.
				const ptListKey = Object.keys(dataModel).find(
					(k) => this.compatibilityService.getXmlLocalName(k) === 'ptLst',
				);
				const cxnListKey = Object.keys(dataModel).find(
					(k) => this.compatibilityService.getXmlLocalName(k) === 'cxnLst',
				);
				const ptList = ptListKey ? (dataModel[ptListKey] as XmlObject) : undefined;
				const cxnList = cxnListKey ? (dataModel[cxnListKey] as XmlObject) : undefined;
				const ptKey = ptList
					? Object.keys(ptList).find((k) => this.compatibilityService.getXmlLocalName(k) === 'pt')
					: undefined;
				const cxnKey = cxnList
					? Object.keys(cxnList).find((k) => this.compatibilityService.getXmlLocalName(k) === 'cxn')
					: undefined;

				let existingPts = ptKey && ptList ? (this.ensureArray(ptList[ptKey]) as XmlObject[]) : [];
				let existingCxns =
					cxnKey && cxnList ? (this.ensureArray(cxnList[cxnKey]) as XmlObject[]) : [];
				// `smartArtData.connections` only tracks data-graph `parOf` edges; a
				// synthesised node's presOf / presParOf wiring has no counterpart
				// there, so it's grafted on separately (see synthesizeNewSmartArtStructuralPoints).
				let desiredConnections = smartArtData.connections;

				if (ptKey && cxnKey) {
					// Graft the parTrans / sibTrans / presentation-point scaffolding a
					// brand-new content node needs (see smartart-node-synthesis.ts) so
					// the merges below see it as an already-existing point/connection
					// and pass it through untouched instead of leaving it orphaned --
					// an orphaned content point is schema-valid XML that PowerPoint
					// still rejects as a corrupt file on open.
					const synthesized = synthesizeNewSmartArtStructuralPoints(
						existingPts,
						existingCxns,
						smartArtData.nodes,
						smartArtData.connections,
					);
					existingPts = synthesized.pts;
					existingCxns = synthesized.cxns;
					if (synthesized.extraConnections.length > 0) {
						desiredConnections = [...(desiredConnections ?? []), ...synthesized.extraConnections];
					}
				}

				// Surgically merge the node data into the EXISTING dgm:ptLst so
				// presentation points (type="pres"), the doc point, and every
				// point's prSet / spPr / extLst survive the round-trip.
				if (ptKey && ptList) {
					ptList[ptKey] = mergeSmartArtPointXml(existingPts, smartArtData.nodes);
				}

				// Surgically merge dgm:cxnLst so each unchanged connection keeps its
				// required @_modelId (and parTransId / sibTransId / presId) instead
				// of being rebuilt from scratch and losing them.
				if (cxnKey && cxnList && desiredConnections && desiredConnections.length > 0) {
					cxnList[cxnKey] = mergeSmartArtConnectionXml(existingCxns, desiredConnections);
				}

				const saveLayout = smartArtData.layoutDirty
					? resolveSmartArtSaveLayout(smartArtData)
					: undefined;
				if (saveLayout) {
					applySmartArtLayoutIdentity(dataModel, saveLayout, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				// Persist chrome (background / outline) onto dgm:bg and
				// dgm:whole/a:ln when present on the in-memory data.
				applySmartArtChrome(dataModel, smartArtData.chrome, (k) =>
					this.compatibilityService.getXmlLocalName(k),
				);

				this.zip.file(dataPartPath, this.builder.build(parsed));

				if (saveLayout && smartArtData.layoutRelId) {
					const layoutTarget = relationships?.get(smartArtData.layoutRelId);
					if (layoutTarget) {
						this.zip.file(this.resolveImagePath(slidePath, layoutTarget), saveLayout.xml);
					}
				}

				if (smartArtData.drawingDirty && smartArtData.drawingRelId) {
					const drawingTarget = relationships?.get(smartArtData.drawingRelId);
					const drawingShapes = smartArtData.drawingShapes?.length
						? smartArtData.drawingShapes
						: smartArtElementsToDrawingShapes(
								decomposeSmartArt(smartArtData, {
									x: 0,
									y: 0,
									width: Math.max(element.width, 1),
									height: Math.max(element.height, 1),
								}),
							);
					const mergedPoints =
						ptKey && ptList ? (this.ensureArray(ptList[ptKey]) as XmlObject[]) : [];
					const presentationIds = presentationIdsFromPoints(mergedPoints, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
					const drawingXml = buildFabricatedDrawingXml(
						drawingShapes,
						smartArtData.nodes,
						presentationIds,
					);
					if (drawingTarget && drawingXml) {
						this.zip.file(this.resolveImagePath(slidePath, drawingTarget), drawingXml);
					}
				}
			} catch (e) {
				console.warn(`Failed to save SmartArt data at ${dataPartPath}:`, e);
			}

			// Regenerate the colours diagram part so a colour-scheme change
			// persists across a round-trip instead of PowerPoint re-deriving
			// the old values on open.
			await this.regenerateSmartArtColorPart(slidePath, smartArtData);
			await this.regenerateSmartArtQuickStylePart(slidePath, smartArtData);
			await this.regenerateSmartArtLayoutDefinition(slidePath, smartArtData);
		}

		this.pendingSmartArtUpdates = undefined;
	}

	/** Merge edited CT_DiagramDefinition metadata into the existing layout part. */
	protected async regenerateSmartArtLayoutDefinition(
		slidePath: string,
		smartArtData: SmartArtPptxElement['smartArtData'],
	): Promise<void> {
		const definition = smartArtData?.layoutDefinition;
		if (!smartArtData?.layoutDefinitionDirty || !smartArtData.layoutRelId || !definition) {
			return;
		}
		await this.mergeSmartArtDiagramPart(
			slidePath,
			smartArtData.layoutRelId,
			'layoutDef',
			'layout definition',
			(layoutDef) =>
				applySmartArtLayoutDefinition(layoutDef, definition, (key) =>
					this.compatibilityService.getXmlLocalName(key),
				),
		);
	}

	/**
	 * Merge the in-memory colour transform back into `ppt/diagrams/colors*.xml`.
	 *
	 * Resolves the part via the SmartArt `colorsRelId` relationship alongside
	 * the data part, merges surgically (preserving unknown content), and skips
	 * gracefully when the rel or part is absent. No-op when the in-memory data
	 * carries no colour transform.
	 */
	protected async regenerateSmartArtColorPart(
		slidePath: string,
		smartArtData: SmartArtPptxElement['smartArtData'],
	): Promise<void> {
		const transform = smartArtData?.colorTransform;
		if (!smartArtData?.colorsRelId || !transform) {
			return;
		}
		await this.mergeSmartArtDiagramPart(
			slidePath,
			smartArtData.colorsRelId,
			'colorsDef',
			'colours',
			(colorsDef) =>
				applySmartArtColorTransform(colorsDef, transform, (k) =>
					this.compatibilityService.getXmlLocalName(k),
				),
		);
	}

	/** Merge dirty CT_StyleDefinition metadata into the related quick-style part. */
	protected async regenerateSmartArtQuickStylePart(
		slidePath: string,
		smartArtData: SmartArtPptxElement['smartArtData'],
	): Promise<void> {
		const quickStyle = smartArtData?.quickStyle;
		if (!smartArtData?.quickStyleDirty || !smartArtData.styleRelId || !quickStyle) {
			return;
		}
		await this.mergeSmartArtDiagramPart(
			slidePath,
			smartArtData.styleRelId,
			'styleDef',
			'quick style',
			(styleDef) =>
				applySmartArtQuickStyle(styleDef, quickStyle, (key) =>
					this.compatibilityService.getXmlLocalName(key),
				),
		);
	}

	/**
	 * Read a SmartArt diagram part by slide relationship id, locate its root
	 * definition element by local name, apply a surgical merge callback, and
	 * write the part back only when the callback reports a change. Skips
	 * gracefully when the rel, part, or root element is absent.
	 */
	private async mergeSmartArtDiagramPart(
		slidePath: string,
		relId: string,
		defLocalName: string,
		label: string,
		merge: (def: XmlObject) => boolean,
	): Promise<void> {
		const relationships = this.slideRelsMap.get(slidePath);
		const target = relationships?.get(relId);
		if (!target) {
			return;
		}
		const partPath = this.resolveImagePath(slidePath, target);
		const existingXml = await this.zip.file(partPath)?.async('string');
		if (!existingXml) {
			return;
		}

		try {
			const parsed = this.parser.parse(existingXml) as XmlObject;
			const def = this.xmlLookupService.getChildByLocalName(parsed, defLocalName);
			if (def && merge(def)) {
				this.zip.file(partPath, this.builder.build(parsed));
			}
		} catch (e) {
			console.warn(`Failed to save SmartArt ${label} at ${partPath}:`, e);
		}
	}

	/**
	 * Find the slide path for an element by scanning the slideMap.
	 */
	protected findSlidePathForElement(_element: PptxElement): string | undefined {
		// The element's slide path can be found by looking at the slideRelsMap entries
		for (const [slidePath] of this.slideRelsMap) {
			if (this.slideMap.has(slidePath)) {
				return slidePath;
			}
		}
		return this.orderedSlidePaths[0];
	}

	/**
	 * Apply notes master background colour changes to `notesMaster1.xml`.
	 */
	protected async applyNotesMasterChanges(notesMaster: PptxNotesMaster | undefined): Promise<void> {
		if (!notesMaster) {
			return;
		}
		const file = this.zip.file(notesMaster.path);
		if (!file) {
			return;
		}

		try {
			const xml = await file.async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const root = data?.['p:notesMaster'] as XmlObject | undefined;
			if (!root) {
				return;
			}

			const cSld = (root['p:cSld'] || {}) as XmlObject;

			// Update background colour
			if (notesMaster.backgroundColor) {
				const hex = notesMaster.backgroundColor.replace('#', '');
				cSld['p:bg'] = {
					'p:bgPr': {
						'a:solidFill': { 'a:srgbClr': { '@_val': hex } },
						'a:effectLst': {},
					},
				};
			}

			root['p:cSld'] = cSld;
			data['p:notesMaster'] = root;
			this.zip.file(notesMaster.path, this.builder.build(data));
		} catch (e) {
			console.warn('Failed to save notes master changes:', e);
		}
	}

	/**
	 * Apply handout master background colour and slides-per-page changes
	 * to `handoutMaster1.xml`.
	 */
	protected async applyHandoutMasterChanges(
		handoutMaster: PptxHandoutMaster | undefined,
	): Promise<void> {
		if (!handoutMaster) {
			return;
		}
		const file = this.zip.file(handoutMaster.path);
		if (!file) {
			return;
		}

		try {
			const xml = await file.async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const root = data?.['p:handoutMaster'] as XmlObject | undefined;
			if (!root) {
				return;
			}

			const cSld = (root['p:cSld'] || {}) as XmlObject;

			// Update background colour
			if (handoutMaster.backgroundColor) {
				const hex = handoutMaster.backgroundColor.replace('#', '');
				cSld['p:bg'] = {
					'p:bgPr': {
						'a:solidFill': { 'a:srgbClr': { '@_val': hex } },
						'a:effectLst': {},
					},
				};
			}

			root['p:cSld'] = cSld;
			data['p:handoutMaster'] = root;
			this.zip.file(handoutMaster.path, this.builder.build(data));
		} catch (e) {
			console.warn('Failed to save handout master changes:', e);
		}
	}

	/**
	 * Persist tag collection changes back to `ppt/tags/tag*.xml`.
	 */
	protected async applyTagCollectionChanges(tags: PptxTagCollection[] | undefined): Promise<void> {
		if (!tags || tags.length === 0) {
			return;
		}
		await writeTagCollections(this.zip, tags, {
			parse: (xml) => this.parser.parse(xml) as XmlObject,
			build: (data) => this.builder.build(data),
		});
	}

	/** Author presentation and slide customer-data lists and their CustomXmlPart relationships. */
	protected async applyCustomerDataChanges(
		presentationEntries: PptxCustomerData[] | undefined,
		slides: PptxSlide[],
	): Promise<void> {
		const scopes: CustomerDataScope[] = slides
			.filter((slide) => slide.customerData !== undefined)
			.map((slide) => ({
				sourcePartPath: slide.id,
				location: 'slide' as const,
				entries: slide.customerData!,
			}));
		if (presentationEntries !== undefined) {
			scopes.unshift({
				sourcePartPath: 'ppt/presentation.xml',
				location: 'presentation',
				entries: presentationEntries,
			});
		}
		await writeCustomerDataScopes(this.zip, scopes, {
			parse: (xml) => this.parser.parse(xml) as XmlObject,
			build: (data) => this.builder.build(data),
		});
	}

	/**
	 * Write custom XML data parts back to the ZIP package for round-trip
	 * preservation. Each part writes `customXml/item{id}.xml` and, when
	 * present, `customXml/itemProps{id}.xml` and
	 * `customXml/_rels/item{id}.xml.rels`.
	 */
	protected applyCustomXmlPartsPreservation(): void {
		if (this.customXmlParts.length === 0) {
			return;
		}

		// Reject part ids containing path-traversal or otherwise unsafe characters
		// (e.g. "1/../../docProps/app") that would let a hostile input file
		// overwrite arbitrary parts in the saved ZIP. Fall back to a safe
		// sequential index for any rejected id.
		const SAFE_ID = /^[A-Za-z0-9_-]+$/u;
		let fallbackIndex = 1;
		for (const part of this.customXmlParts) {
			const rawId = String(part.id);
			const safeId = SAFE_ID.test(rawId) ? rawId : String(fallbackIndex++);
			this.zip.file(`customXml/item${safeId}.xml`, part.data);
			if (part.properties) {
				this.zip.file(`customXml/itemProps${safeId}.xml`, part.properties);
			}
			if (part.rels) {
				this.zip.file(`customXml/_rels/item${safeId}.xml.rels`, part.rels);
			}
		}
	}

	/**
	 * Write the preserved thumbnail image back into the ZIP package.
	 *
	 * Looks for an existing thumbnail entry to determine the correct
	 * file path (`.jpeg`, `.jpg`, `.png`, `.emf`). If none exists,
	 * defaults to `docProps/thumbnail.jpeg`.
	 */
	protected applyThumbnailPreservation(): void {
		if (!this.thumbnailData) {
			return;
		}

		const candidates = [
			'docProps/thumbnail.jpeg',
			'docProps/thumbnail.jpg',
			'docProps/thumbnail.png',
			'docProps/thumbnail.emf',
		];
		let targetPath = 'docProps/thumbnail.jpeg';
		for (const path of candidates) {
			if (this.zip.file(path)) {
				targetPath = path;
				break;
			}
		}

		this.zip.file(targetPath, this.thumbnailData);
	}

	/**
	 * Preserve VBA macro project binary for .pptm round-trip.
	 */
	protected async applyVbaProjectPreservation(): Promise<void> {
		if (!this.vbaProjectBin) {
			return;
		}

		// Write the raw VBA project binary back
		this.zip.file('ppt/vbaProject.bin', this.vbaProjectBin);

		// Write any additional VBA-related parts (vbaData.xml, etc.)
		for (const [partPath, partData] of this.vbaRelatedParts) {
			this.zip.file(partPath, partData);
		}
	}

	/**
	 * Rewrite `[Content_Types].xml` and presentation relationships
	 * to match the chosen output format (PPSX / PPTM).
	 */
	protected async applyOutputFormatOverrides(format: PptxSaveFormat): Promise<void> {
		if (format === 'pptx') {
			return;
		}

		const hasVba = this.vbaProjectBin !== null;

		// Update [Content_Types].xml with format-specific overrides
		const ctXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (ctXml) {
			const ctData = this.parser.parse(ctXml) as XmlObject;
			this.contentTypesBuilder.applyOutputFormatOverride(ctData, format, hasVba);
			this.zip.file('[Content_Types].xml', this.builder.build(ctData));
		}

		// For PPTM, ensure the VBA relationship exists in presentation.xml.rels
		if (format === 'pptm' && hasVba) {
			await this.ensureVbaRelationship();
		}
	}

	// ── Font re-embedding ─────────────────────────────────────────────

	/** Relationship type URI for embedded fonts. */
	private static readonly FONT_REL_TYPE =
		'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';

	/** Content type for .fntdata font parts. */
	private static readonly FNTDATA_CONTENT_TYPE = 'application/x-fontdata';

	/**
	 * Re-embed fonts into the PPTX package during save.
	 *
	 * For each font that has `rawFontData` populated:
	 *  1. Obfuscate the clear-text font data using the GUID.
	 *  2. Write the `.fntdata` file to `ppt/fonts/{GUID}.fntdata`.
	 *  3. Add a relationship in `ppt/_rels/presentation.xml.rels`.
	 *  4. Add/update the `p:embeddedFontLst` in `presentation.xml`.
	 *  5. Ensure `[Content_Types].xml` has a Default for `fntdata`.
	 *
	 * @param explicitFonts - Fonts from save options, or undefined for auto.
	 */
	protected async applyEmbeddedFontPreservation(
		explicitFonts?: PptxEmbeddedFont[],
		explicitFontList?: PptxEmbeddedFontList | null,
	): Promise<void> {
		if (explicitFontList === null) {
			await this.removeEmbeddedFontPackageData();
			return;
		}

		// Determine which fonts to embed:
		// - explicit list from save options takes priority
		// - fallback: fonts loaded from the original PPTX
		const fonts = explicitFonts ?? this.loadedEmbeddedFonts;
		const fontsWithData = fonts.filter((f) => f.rawFontData && f.rawFontData.length > 0);
		if (fontsWithData.length === 0) {
			const metadata = explicitFontList ?? this.loadedEmbeddedFontList;
			if (metadata && this.presentationData) {
				setEmbeddedFontList(this.presentationData, serializeEmbeddedFontList(metadata));
			}
			return;
		}

		// ── 1. Group fonts by typeface name ───────────────────────────
		const fontsByName = new Map<string, PptxEmbeddedFont[]>();
		for (const font of fontsWithData) {
			const existing = fontsByName.get(font.name) ?? [];
			existing.push(font);
			fontsByName.set(font.name, existing);
		}

		// ── 2. Load presentation rels ─────────────────────────────────
		const relsPath = 'ppt/_rels/presentation.xml.rels';
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml || !this.presentationData) {
			return;
		}

		const relsData = this.parser.parse(relsXml) as XmlObject;
		const relsRoot = (relsData?.Relationships ?? {}) as XmlObject;
		const relationships = this.ensureArray(relsRoot.Relationship) as XmlObject[];

		// Find max rId currently in use
		let maxId = 0;
		for (const rel of relationships) {
			const id = String(rel?.['@_Id'] || '');
			const num = parseInt(id.replace(/^rId/u, ''), 10);
			if (Number.isFinite(num) && num > maxId) {
				maxId = num;
			}
		}

		// Build set of existing font file targets for dedup
		const existingFontTargets = new Set<string>();
		for (const rel of relationships) {
			const relType = String(rel?.['@_Type'] || '');
			if (relType.includes('/font')) {
				existingFontTargets.add(String(rel?.['@_Target'] || ''));
			}
		}

		// ── 3. Process each font family ──────────────────────────────
		const embeddedFontEntries: XmlObject[] = [];

		for (const [typeface, variants] of fontsByName) {
			const entry: XmlObject = {
				'p:font': { '@_typeface': typeface },
			};

			for (const variant of variants) {
				const fontData = variant.rawFontData!;

				// Determine what we can reuse from the load side. A variant
				// was loaded from an existing part when it has `originalRId`
				// and `partPath`; when it also has a `fontGuid` we can
				// re-obfuscate and overwrite the original part. When the
				// loader couldn't resolve a GUID (e.g. EOT extraction path),
				// we preserve the original bytes verbatim.
				const hasOriginal = Boolean(variant.originalRId && variant.partPath);
				const reuseObfuscation = hasOriginal && Boolean(variant.fontGuid);
				const reuseVerbatim =
					hasOriginal && !variant.fontGuid && Boolean(variant.originalPartBytes);

				let guid: string;
				let fontPartPath: string;
				let relativeTarget: string;
				let rId: string;
				let bytesToWrite: Uint8Array;

				if (reuseObfuscation) {
					guid = variant.fontGuid!;
					fontPartPath = variant.partPath!;
					relativeTarget = fontPartPath.startsWith('ppt/')
						? fontPartPath.substring(4)
						: fontPartPath;
					rId = variant.originalRId!;
					bytesToWrite = obfuscateFont(fontData, guid);
				} else if (reuseVerbatim) {
					// No usable GUID: preserve original bytes + rel unchanged.
					guid = '';
					fontPartPath = variant.partPath!;
					relativeTarget = fontPartPath.startsWith('ppt/')
						? fontPartPath.substring(4)
						: fontPartPath;
					rId = variant.originalRId!;
					bytesToWrite = variant.originalPartBytes!;
					// fontKey attribute intentionally omitted — the source
					// file didn't declare one and emitting a synthetic GUID
					// would not match the opaque bytes on disk.
				} else {
					// New / externally-supplied font: mint a fresh GUID-named part.
					guid = variant.fontGuid ?? generateFontGuid();
					const fileName = `{${guid}}.fntdata`;
					fontPartPath = `ppt/fonts/${fileName}`;
					relativeTarget = `fonts/${fileName}`;
					bytesToWrite = obfuscateFont(fontData, guid);

					// Reuse an existing rel pointing at the same target,
					// otherwise allocate a new rId.
					const existingRel = relationships.find(
						(r) => String(r?.['@_Target'] || '') === relativeTarget,
					);
					if (existingRel) {
						rId = String(existingRel['@_Id']);
					} else {
						maxId++;
						rId = `rId${maxId}`;
						relationships.push({
							'@_Id': rId,
							'@_Type': PptxHandlerRuntime.FONT_REL_TYPE,
							'@_Target': relativeTarget,
						});
					}
				}

				this.zip.file(fontPartPath, bytesToWrite);

				// Determine variant key
				const variantKey =
					variant.bold && variant.italic
						? 'p:boldItalic'
						: variant.bold
							? 'p:bold'
							: variant.italic
								? 'p:italic'
								: 'p:regular';

				entry[variantKey] = { '@_r:id': rId };
			}

			embeddedFontEntries.push(entry);
		}

		// ── 4. Update presentation.xml.rels ──────────────────────────
		relsRoot.Relationship = relationships;
		relsData.Relationships = relsRoot;
		this.zip.file(relsPath, this.builder.build(relsData));

		// ── 5. Update p:embeddedFontLst in presentation.xml ──────────
		if (this.presentationData) {
			const generatedList: XmlObject = {
				'p:embeddedFont':
					embeddedFontEntries.length === 1 ? embeddedFontEntries[0] : embeddedFontEntries,
			};
			const metadata = explicitFontList
				? serializeEmbeddedFontList(explicitFontList)
				: explicitFonts === undefined && this.loadedEmbeddedFontList
					? serializeEmbeddedFontList(this.loadedEmbeddedFontList)
					: generatedList;
			setEmbeddedFontList(this.presentationData, metadata);
		}

		// ── 6. Ensure [Content_Types].xml has fntdata extension ──────
		const ctXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (ctXml) {
			const ctData = this.parser.parse(ctXml) as XmlObject;
			const typesRoot = (ctData['Types'] || {}) as XmlObject;
			const defaults = Array.isArray(typesRoot['Default'])
				? (typesRoot['Default'] as XmlObject[])
				: typesRoot['Default']
					? [typesRoot['Default'] as XmlObject]
					: [];

			const hasFntdata = defaults.some(
				(d) => String(d?.['@_Extension'] || '').toLowerCase() === 'fntdata',
			);
			if (!hasFntdata) {
				defaults.push({
					'@_Extension': 'fntdata',
					'@_ContentType': PptxHandlerRuntime.FNTDATA_CONTENT_TYPE,
				});
			}

			typesRoot['Default'] = defaults;
			ctData['Types'] = typesRoot;
			this.zip.file('[Content_Types].xml', this.builder.build(ctData));
		}
	}

	private async removeEmbeddedFontPackageData(): Promise<void> {
		if (this.presentationData) {
			setEmbeddedFontList(this.presentationData, null);
		}
		const relsPath = 'ppt/_rels/presentation.xml.rels';
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return;
		}
		const relsData = this.parser.parse(relsXml) as XmlObject;
		const root = (relsData.Relationships ?? {}) as XmlObject;
		const relationships = this.ensureArray(root.Relationship) as XmlObject[];
		const retained: XmlObject[] = [];
		for (const relationship of relationships) {
			if (!String(relationship['@_Type'] ?? '').includes('/font')) {
				retained.push(relationship);
				continue;
			}
			const target = String(relationship['@_Target'] ?? '');
			const path = safeResolveZipPath('ppt', target);
			if (path) {
				this.zip.remove(path);
			}
		}
		root.Relationship = retained;
		relsData.Relationships = root;
		this.zip.file(relsPath, this.builder.build(relsData));
	}

	/**
	 * Ensure `ppt/_rels/presentation.xml.rels` contains a relationship
	 * entry for `vbaProject.bin` (required for macro-enabled output).
	 */
	protected async ensureVbaRelationship(): Promise<void> {
		const relsPath = 'ppt/_rels/presentation.xml.rels';
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return;
		}

		const relsData = this.parser.parse(relsXml) as XmlObject;
		const relsRoot = (relsData?.Relationships ?? {}) as XmlObject;
		const relationships = this.ensureArray(relsRoot.Relationship) as XmlObject[];

		const vbaRelType = 'http://schemas.microsoft.com/office/2006/relationships/vbaProject';
		const hasVbaRel = relationships.some((rel) => String(rel?.['@_Type'] || '') === vbaRelType);
		if (hasVbaRel) {
			return;
		}

		// Compute a unique rId
		let maxId = 0;
		for (const rel of relationships) {
			const id = String(rel?.['@_Id'] || '');
			const num = parseInt(id.replace(/^rId/u, ''), 10);
			if (Number.isFinite(num) && num > maxId) {
				maxId = num;
			}
		}

		relationships.push({
			'@_Id': `rId${maxId + 1}`,
			'@_Type': vbaRelType,
			'@_Target': 'vbaProject.bin',
		});

		relsRoot.Relationship = relationships;
		relsData.Relationships = relsRoot;
		this.zip.file(relsPath, this.builder.build(relsData));
	}

	/**
	 * Convert all XML parts in the ZIP archive from Transitional namespace URIs
	 * to Strict namespace URIs.
	 *
	 * This is the final step in the save pipeline when the effective conformance
	 * class is `'strict'`. It re-parses each XML entry, applies
	 * `convertXmlToStrict` in-place, and writes the converted XML back.
	 *
	 * The `p:presentation` root element receives `conformance="strict"` to
	 * satisfy the ISO/IEC 29500 Strict schema.
	 */
	protected async convertZipToStrictConformance(): Promise<void> {
		const xmlPaths: string[] = [];
		this.zip.forEach((relativePath) => {
			if (relativePath.endsWith('.xml') || relativePath.endsWith('.rels')) {
				xmlPaths.push(relativePath);
			}
		});

		// Use the original (unwrapped) parser for this conversion — the Proxy
		// wrapper would auto-normalize Strict→Transitional which is the opposite
		// of what we want.
		const rawParser =
			(this as unknown as { _originalParser?: unknown })._originalParser || this.parser;
		const parse =
			typeof (rawParser as { parse?: unknown }).parse === 'function'
				? (rawParser as { parse: (s: string) => unknown }).parse.bind(rawParser)
				: this.parser.parse.bind(this.parser);

		for (const path of xmlPaths) {
			const file = this.zip.file(path);
			if (!file) {
				continue;
			}

			const xmlText = await file.async('string');
			if (!xmlText.trim()) {
				continue;
			}

			try {
				const parsed = parse(xmlText) as Record<string, unknown>;
				if (typeof parsed !== 'object' || parsed === null) {
					continue;
				}

				// presentation.xml gets the conformance="strict" attribute
				const isPresentationXml = path === 'ppt/presentation.xml';
				convertXmlToStrict(parsed, isPresentationXml);

				this.zip.file(path, this.builder.build(parsed));
			} catch {
				// If a part fails to parse (binary content with .xml extension, etc.)
				// leave it unchanged — this is a best-effort conversion.
			}
		}
	}
}
