import type JSZip from 'jszip';

import { PptxXmlBuilder } from '../../builders/fluent';
import {
	PptxData,
	PptxSlide,
	PptxSlideMaster,
	PptxCompatibilityWarning,
	PptxElement,
	XmlObject,
} from '../../types';
import type { PptxSection, PptxLayoutOption } from '../../types';
import { parseEmbeddedFontList } from '../../utils/embedded-font-list';
import { parsePresentationDrawingGuides } from '../../utils/guide-utils';
import { resolveLayoutDisplayName } from '../../utils/layout-display-name';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';
import { PptxLoadDataBuilder } from '../builders';
import type { PptxHandlerLoadOptions } from '../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLoadSession';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async buildLoadData(
		presentationState: {
			width: number;
			height: number;
			notesWidthEmu: number;
			notesHeightEmu: number;
			orderedSections: PptxSection[];
		},
		slidesWithWarnings: PptxSlide[],
		slideMasters: PptxSlideMaster[],
	): Promise<PptxData> {
		const headerFooter = this.extractHeaderFooter();
		const presentationProperties = await this.parsePresentationProperties();
		const viewProperties = await this.parseViewProperties();
		// Preserve for automatic re-emission during save (issue #90).
		this.loadedViewProperties = viewProperties;
		const customShows = this.parseCustomShows();
		const tableStyleMap = await this.parseTableStyles();
		const embeddedFontList = parseEmbeddedFontList(this.presentationData);
		const embeddedFonts = await this.getEmbeddedFonts(embeddedFontList);
		// Preserve for automatic re-embedding during save
		this.loadedEmbeddedFonts = embeddedFonts;
		this.loadedEmbeddedFontList = embeddedFontList;
		const themeOptions = await this.parseThemeOptions();
		const notesMaster = await this.parseNotesMaster();
		const handoutMaster = await this.parseHandoutMaster();
		const handoutMatch =
			presentationProperties?.printProperties?.printWhat?.match(/^handouts([123469])$/u);
		if (handoutMaster && handoutMatch) {
			handoutMaster.slidesPerPage = Number.parseInt(handoutMatch[1], 10);
		}
		await this.enrichAuxiliaryMasterElements(notesMaster, 'p:notesMaster');
		await this.enrichAuxiliaryMasterElements(handoutMaster, 'p:handoutMaster');
		const tags = await this.parseTags();
		const customProperties = await this.parseCustomProperties();
		const coreProperties = await this.parseCoreProperties();
		const appProperties = await this.parseAppProperties();
		const presentationGuides = this.presentationData
			? parsePresentationDrawingGuides(this.presentationData)
			: [];
		const photoAlbum = this.extractPhotoAlbum();
		const modifyVerifier = this.extractModifyVerifier();
		const kinsoku = this.extractKinsoku();
		const customerData = await this.parsePresentationCustomerData();
		this.thumbnailData = (await this.parseThumbnail()) ?? null;

		return new PptxLoadDataBuilder()
			.withDimensions(
				presentationState.width,
				presentationState.height,
				this.rawSlideWidthEmu,
				this.rawSlideHeightEmu,
			)
			.withNotesDimensions(presentationState.notesWidthEmu, presentationState.notesHeightEmu)
			.withSlides(slidesWithWarnings)
			.withLayoutOptions(this.getLayoutOptions())
			.withHeaderFooter(headerFooter)
			.withPresentationProperties(presentationProperties)
			.withViewProperties(viewProperties)
			.withCustomShows(customShows)
			.withSections(
				presentationState.orderedSections.length > 0
					? presentationState.orderedSections
					: undefined,
			)
			.withWarnings(this.compatibilityService.getWarnings())
			.withThemeColorMap({ ...this.themeColorMap })
			.withTheme(this.buildThemeObject())
			.withThemeOptions(themeOptions.length > 0 ? themeOptions : undefined)
			.withTableStyleMap(tableStyleMap)
			.withEmbeddedFonts(embeddedFonts.length > 0 ? embeddedFonts : undefined)
			.withEmbeddedFontList(embeddedFontList)
			.withMruColors(presentationProperties?.mruColors)
			.withNotesMaster(notesMaster)
			.withHandoutMaster(handoutMaster)
			.withSlideMasters(slideMasters.length > 0 ? slideMasters : undefined)
			.withTags(tags.length > 0 ? tags : undefined)
			.withCustomProperties(customProperties.length > 0 ? customProperties : undefined)
			.withCoreProperties(coreProperties)
			.withAppProperties(appProperties)
			.withHasMacros(this.vbaProjectBin !== null ? true : undefined)
			.withHasDigitalSignatures(this.signatureDetection?.hasSignatures || undefined)
			.withDigitalSignatureCount(
				this.signatureDetection?.signatureCount && this.signatureDetection.signatureCount > 0
					? this.signatureDetection.signatureCount
					: undefined,
			)
			.withPresentationGuides(presentationGuides.length > 0 ? presentationGuides : undefined)
			.withPhotoAlbum(photoAlbum)
			.withKinsoku(kinsoku)
			.withModifyVerifier(modifyVerifier)
			.withCustomXmlParts(this.customXmlParts.length > 0 ? this.customXmlParts : undefined)
			.withCustomerData(customerData.length > 0 ? customerData : undefined)
			.withSlideSizeType(this.rawSlideSizeType)
			.withThumbnailData(this.thumbnailData ?? undefined)
			.withCommentAuthors(
				this.commentAuthorDetails.size > 0
					? Array.from(this.commentAuthorDetails.values())
					: undefined,
			)
			.withModernCommentAuthors(
				this.modernCommentAuthors.size > 0
					? Array.from(this.modernCommentAuthors.values())
					: undefined,
			)
			.withConformance(this.isStrictOoxml ? 'strict' : 'transitional')
			.build();
	}

	/**
	 * Walk the raw XML of every slide to find the highest numeric `@_id`
	 * attribute on `p:cNvPr` / `p:cNvCxnSpPr` / `p:cNvPicPr` nodes.
	 * This is used to seed the element builder's ID counter so that
	 * new elements never collide with existing ones.
	 *
	 * Implementation note (Load H1): uses an explicit-stack iterative walk
	 * instead of recursion to bound stack usage on attacker-supplied XML
	 * with deeply nested nodes. Also caps total visited nodes at
	 * MAX_NODES to bound CPU on pathological trees.
	 */
	protected findMaxElementId(slides: PptxSlide[]): number {
		const MAX_NODES = 1_000_000;
		let max = 0;
		const stack: unknown[] = [];
		for (const slide of slides) {
			stack.push(slide.rawXml);
		}
		let visited = 0;
		while (stack.length > 0) {
			if (visited++ > MAX_NODES) {
				break;
			}
			const node = stack.pop();
			if (node === null || node === undefined || typeof node !== 'object') {
				continue;
			}
			if (Array.isArray(node)) {
				for (const item of node) {
					if (item !== null && item !== undefined && typeof item === 'object') {
						stack.push(item);
					}
				}
				continue;
			}
			const obj = node as Record<string, unknown>;
			if ('@_id' in obj) {
				const id = parseInt(String(obj['@_id']), 10);
				if (Number.isFinite(id) && id > max) {
					max = id;
				}
			}
			for (const value of Object.values(obj)) {
				if (value === null || value === undefined) {
					continue;
				}
				if (Array.isArray(value) || typeof value === 'object') {
					stack.push(value);
				}
			}
		}
		return max;
	}

	protected resetElementIdCounter(slides: PptxSlide[]): void {
		const maxExistingId = this.findMaxElementId(slides);
		this.elementXmlBuilder.resetIdCounter(maxExistingId + 1);
	}

	protected attachSlideWarnings(slides: PptxSlide[]): PptxSlide[] {
		const warnings = this.compatibilityService.getWarnings();
		const warningsBySlide = new Map<string, PptxCompatibilityWarning[]>();
		for (const warning of warnings) {
			if (!warning.slideId) {
				continue;
			}
			const slideWarnings = warningsBySlide.get(warning.slideId);
			if (slideWarnings) {
				slideWarnings.push(warning);
			} else {
				warningsBySlide.set(warning.slideId, [warning]);
			}
		}
		return slides.map((slide) => ({
			...slide,
			warnings: warningsBySlide.get(slide.id) ?? [],
		}));
	}

	/**
	 * Revoke all Blob URLs created during image loading.
	 * Safe to call in non-browser environments (no-op).
	 */
	revokeBlobUrls(): void {
		if (typeof globalThis.URL?.revokeObjectURL === 'function' && this.blobUrlCache.size > 0) {
			for (const url of this.blobUrlCache) {
				URL.revokeObjectURL(url);
			}
			this.blobUrlCache.clear();
		}
	}

	/**
	 * Release all resources held by this handler instance.
	 *
	 * - Revokes every Blob URL created for images/media.
	 * - Clears all in-memory caches (image data, XML trees, relationships).
	 * - Nulls out the in-memory ZIP archive (largest single allocation).
	 *
	 * After calling `dispose()`, the handler cannot load new data, save,
	 * or resolve images.  Create a new `PptxHandler` instance instead.
	 */
	dispose(): void {
		this.revokeBlobUrls();
		this.imageDataCache.clear();
		this.slideMap.clear();
		this.slideRelsMap.clear();
		this.externalRelsMap.clear();
		this.layoutCache.clear();
		this.masterCache.clear();
		this.layoutXmlMap.clear();
		this.masterXmlMap.clear();
		this.masterTxStylesCache.clear();
		this.layoutPlaceholderDefaultsCache.clear();
		this.masterPlaceholderDefaultsCache.clear();
		this.themeOverrideCache.clear();
		this.commentAuthorMap.clear();
		this.commentAuthorDetails.clear();
		this.vbaRelatedParts.clear();
		this.presentationData = null;
		this.thumbnailData = null;
		this.vbaProjectBin = null;
		this.customXmlParts = [];
		this.loadedEmbeddedFonts = [];
		this.loadedEmbeddedFontList = undefined;
		this.loadedViewProperties = undefined;
		this.orderedSlidePaths = [];
		// Release the ZIP archive — this is typically the largest allocation
		// (the entire PPTX file contents live here). The handler is unusable
		// after dispose(), so dropping the reference is safe.
		this.zip = null as unknown as JSZip;
	}

	async load(data: ArrayBuffer, options: PptxHandlerLoadOptions = {}): Promise<PptxData> {
		await this.initializeLoadSession(data, options);
		await this.detectAndPreserveVbaProject();
		this.detectDigitalSignatureParts();
		await this.parseCustomXmlParts();
		const presentationState = await this.loadPresentationState();
		const slideMasters = await this.parseSlideMasters();
		await this.enrichSlideMastersWithTxStyles(slideMasters);
		const slides = await this.loadSlidesForPresentation(presentationState.sectionBySlideId);
		const slidesWithWarnings = this.attachSlideWarnings(slides);
		this.resetElementIdCounter(slides);
		return this.buildLoadData(presentationState, slidesWithWarnings, slideMasters);
	}

	/**
	 * Retrieve the current background colour for a layout or master.
	 */
	getTemplateBackgroundColor(path: string): string | undefined {
		return this.templateBackgroundService.getBackgroundColor(
			{
				layoutXmlMap: this.layoutXmlMap,
				masterXmlMap: this.masterXmlMap,
			},
			path,
			(xmlObj, rootTag) => this.extractBackgroundColor(xmlObj, rootTag),
		);
	}

	/**
	 * Update the background colour of a slide layout or slide master XML node.
	 *
	 * @param path - The archive path of the layout or master
	 *               (e.g. `ppt/slideLayouts/slideLayout1.xml`)
	 * @param backgroundColor - Hex colour string (e.g. `#FF0000`) or
	 *                          `undefined` / empty to remove background.
	 */
	setTemplateBackground(path: string, backgroundColor: string | undefined): void {
		this.templateBackgroundService.setBackground(
			{
				layoutXmlMap: this.layoutXmlMap,
				masterXmlMap: this.masterXmlMap,
			},
			path,
			backgroundColor,
		);
	}

	public createXmlBuilder(data: PptxData): PptxXmlBuilder {
		return new PptxXmlBuilder(data);
	}

	public Builder(data: PptxData): PptxXmlBuilder {
		return this.createXmlBuilder(data);
	}

	getCompatibilityWarnings(): PptxCompatibilityWarning[] {
		return this.compatibilityService.getWarnings();
	}

	// ── Layout switching (GAP-E4) ──────────────────────────────────────

	/**
	 * Find the master path that a given layout belongs to by scanning
	 * the layout's own `.rels` file for a `slideMaster` relationship.
	 */
	protected findMasterPathForLayout(layoutPath: string): string | undefined {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}
		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				return target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
			}
		}
		return undefined;
	}

	/**
	 * Find the master path for a slide by walking: slide -> layout -> master.
	 */
	protected findMasterPathForSlide(slidePath: string): string | undefined {
		const layoutPath = this.findLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			return undefined;
		}
		return this.findMasterPathForLayout(layoutPath);
	}

	/**
	 * Resolve the editable template (master + layout) elements a slide
	 * inherits, each carrying a `master-` / `layout-` prefixed id.
	 *
	 * This is the canonical entry point for an "edit template/master"
	 * feature: it returns the same decorative master/layout shapes that the
	 * loader already merges in front of slide-authored content (master shapes
	 * behind, layout shapes on top), reusing the cached
	 * {@link getLayoutElements} parse. Resolving a slide that has not been
	 * loaded yet (no relationships cached) yields an empty array.
	 *
	 * Important scope notes for callers:
	 *  - Placeholder shapes (`<p:ph>`) are intentionally excluded; those are
	 *    resolved separately into each slide's own placeholders. Only
	 *    non-placeholder decorations (shapes, pictures, graphic frames) are
	 *    returned, which is exactly what the save writeback path supports.
	 *  - The returned elements are shared by every slide that inherits the
	 *    same layout/master. Editing one element and saving updates the shared
	 *    layout/master part, so the change is visible on all sibling slides.
	 *  - To persist an edit the binding must keep the mutated template element
	 *    inside the `slide.elements` array it passes to {@link save}; the save
	 *    writer reads template elements from `ctx.slide.elements` and writes
	 *    their shape XML back into the owning `p:spTree`.
	 *
	 * @param slideId - The slide's archive path (the `PptxSlide.id`, e.g.
	 *   `ppt/slides/slide1.xml`).
	 * @returns Master + layout elements with prefixed ids (may be empty).
	 */
	async getTemplateElementsForSlide(slideId: string): Promise<PptxElement[]> {
		return this.getLayoutElements(slideId);
	}

	/**
	 * Get layouts available for a specific slide, scoped to that slide's
	 * master. If the slide's master cannot be determined, returns all
	 * known layouts.
	 */
	async getAvailableLayoutsForSlide(
		slideIndex: number,
		slides: PptxSlide[],
	): Promise<PptxLayoutOption[]> {
		const slide = slides[slideIndex];
		if (!slide) {
			return [];
		}

		const slidePath = slide.id;
		const masterPath = this.findMasterPathForSlide(slidePath);

		if (!masterPath) {
			// Fallback: return all layout options
			return this.getLayoutOptions();
		}

		// Scan the master's .rels for all slideLayout relationships
		const masterRels = this.slideRelsMap.get(masterPath);
		if (!masterRels) {
			return this.getLayoutOptions();
		}

		const masterLayoutPaths = new Set<string>();
		for (const [, target] of masterRels.entries()) {
			if (target.includes('slideLayout')) {
				const masterDir = masterPath.substring(0, masterPath.lastIndexOf('/') + 1);
				const resolved = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(masterDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
				masterLayoutPaths.add(resolved);
			}
		}

		// Build layout options from the filtered set
		const options: PptxLayoutOption[] = [];
		for (const lp of masterLayoutPaths) {
			const xmlObj = this.layoutXmlMap.get(lp);
			if (xmlObj) {
				options.push(this.buildLayoutOption(lp, xmlObj as XmlObject));
			} else {
				// Layout not yet in cache -- try to load from ZIP
				try {
					const layoutXmlStr = await this.zip.file(lp)?.async('string');
					if (layoutXmlStr) {
						const layoutXmlObj = this.parser.parse(layoutXmlStr) as XmlObject;
						this.layoutXmlMap.set(lp, layoutXmlObj);
						options.push(this.buildLayoutOption(lp, layoutXmlObj));
					}
				} catch {
					// Skip unreadable layouts
				}
			}
		}
		return options;
	}

	protected buildLayoutOption(path: string, xmlObj: XmlObject): PptxLayoutOption {
		const sldLayout = xmlObj['p:sldLayout'] as XmlObject | undefined;
		const rawName = String(
			(sldLayout?.['p:cSld'] as XmlObject | undefined)?.['@_name'] || '',
		).trim();
		const typeAttr = sldLayout?.['@_type'];
		const type = typeAttr !== undefined && typeAttr !== null ? String(typeAttr).trim() : undefined;
		const name = resolveLayoutDisplayName({ name: rawName, type, path });
		const masterPath = this.findMasterPathForLayout(path);
		return {
			path,
			name,
			...(type ? { type } : {}),
			...(masterPath ? { masterPath } : {}),
		};
	}

	/**
	 * Apply a different layout to an existing slide.
	 *
	 * This updates the slide's `.rels` file in the in-memory ZIP so the
	 * `slideLayout` relationship points to the new layout, then refreshes
	 * the slide's layout-derived properties (background, layoutPath,
	 * layoutName).
	 */
	async applyLayoutToSlide(
		slideIndex: number,
		layoutPath: string,
		slides: PptxSlide[],
	): Promise<PptxSlide> {
		const slide = slides[slideIndex];
		if (!slide) {
			throw new Error(`Slide index ${slideIndex} out of range`);
		}

		// Verify the target layout exists
		let layoutXml = this.layoutXmlMap.get(layoutPath);
		if (!layoutXml) {
			const layoutXmlStr = await this.zip.file(layoutPath)?.async('string');
			if (!layoutXmlStr) {
				throw new Error(`Layout not found: ${layoutPath}`);
			}
			layoutXml = this.parser.parse(layoutXmlStr) as XmlObject;
			this.layoutXmlMap.set(layoutPath, layoutXml);
		}

		const slidePath = slide.id;

		// ── 1. Update the slide's .rels to point to the new layout ──────
		const slideRelsPath = `${slidePath.replace('slides/', 'slides/_rels/')}.rels`;
		const relsXml = await this.zip.file(slideRelsPath)?.async('string');

		if (relsXml) {
			const relsData = this.parser.parse(relsXml);
			const rels = Array.isArray(relsData?.Relationships?.Relationship)
				? relsData.Relationships.Relationship
				: relsData?.Relationships?.Relationship
					? [relsData.Relationships.Relationship]
					: [];

			// Compute relative target from slide path to layout path
			const relativeTarget = `../slideLayouts/${layoutPath.split('/').pop()}`;

			let found = false;
			for (const r of rels) {
				const relType = String(r['@_Type'] || '');
				if (relType.includes('/slideLayout')) {
					r['@_Target'] = relativeTarget;
					found = true;
					break;
				}
			}

			if (!found) {
				// No existing layout rel -- add one
				const maxRId = rels.reduce((max: number, r: XmlObject) => {
					const id = parseInt(String(r['@_Id'] || 'rId0').replace('rId', ''), 10);
					return Number.isFinite(id) && id > max ? id : max;
				}, 0);
				rels.push({
					'@_Id': `rId${maxRId + 1}`,
					'@_Type':
						'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
					'@_Target': relativeTarget,
				});
			}

			relsData.Relationships.Relationship = rels.length === 1 ? rels[0] : rels;
			const updatedRelsXml = this.builder.build(relsData);
			this.zip.file(slideRelsPath, updatedRelsXml);

			// Update the in-memory relationship map
			const relsMap = this.slideRelsMap.get(slidePath);
			if (relsMap) {
				for (const [rId, target] of relsMap.entries()) {
					if (target.includes('slideLayout')) {
						relsMap.set(rId, relativeTarget);
						break;
					}
				}
			}
		}

		// ── 2. Invalidate layout element cache for the old layout ───────
		this.layoutCache.delete(layoutPath);

		// ── 3. Remap placeholder elements to the new layout ─────────────
		const remappedElements = this.remapElementsToNewLayout(
			slide.elements,
			layoutXml as XmlObject,
			layoutPath,
		);

		// ── 4. Resolve layout name and background ───────────────────────
		const sldLayout = (layoutXml as XmlObject)['p:sldLayout'] as XmlObject | undefined;
		const layoutName =
			String((sldLayout?.['p:cSld'] as XmlObject | undefined)?.['@_name'] || '').trim() ||
			layoutPath;

		// Try to resolve background from the new layout
		const layoutBgColor = this.extractBackgroundColor(layoutXml, 'p:sldLayout');

		// ── 5. Update the slide object ──────────────────────────────────
		const updated: PptxSlide = {
			...slide,
			elements: remappedElements,
			layoutPath,
			layoutName,
			isDirty: true,
		};

		// Apply layout background if slide doesn't have its own
		if (!slide.rawXml || !this.extractBackgroundColor(slide.rawXml)) {
			if (layoutBgColor) {
				updated.backgroundColor = layoutBgColor;
			}
		}

		slides[slideIndex] = updated;
		return updated;
	}
}
