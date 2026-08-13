import { XmlObject, PptxSlide } from '../../types';
import type { PptxHeaderFooter, PptxSlideSize } from '../../types';
import type { OoxmlConformanceClass } from '../../utils';
import { persistModernCommentPackage } from '../../utils/modern-comment-package';
import { PptxSaveStateBuilder } from '../builders';
import { createPptxSaveConstants } from '../factories';
import type { PptxHandlerSaveOptions } from '../types';
import { applyHeaderFooterToMaster } from './header-footer-parts';
import { slidesPerPageToPrintOutput } from './pptx-print-properties';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutInfrastructure';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Resolve the effective conformance class for this save operation.
	 *
	 * - `'preserve'` (default): use the conformance detected at load time
	 * - `'strict'` / `'transitional'`: force that conformance class
	 */
	private resolveEffectiveConformance(
		option: 'strict' | 'transitional' | 'preserve' | undefined,
	): OoxmlConformanceClass {
		if (option === 'strict' || option === 'transitional') {
			return option;
		}
		// 'preserve' or undefined → use source conformance
		return this.isStrictOoxml ? 'strict' : 'transitional';
	}

	async save(slides: PptxSlide[], options?: PptxHandlerSaveOptions): Promise<Uint8Array> {
		const effectiveConformance = this.resolveEffectiveConformance(options?.conformance);
		const saveConstants = createPptxSaveConstants(effectiveConformance);
		const {
			slideRelationshipType,
			slideLayoutRelationshipType,
			relationshipsNamespace,
			slideContentType,
			commentContentType,
			commentAuthorContentType,
			commentAuthorsPartName,
		} = saveConstants;
		this.compatibilityService.resetWarnings();
		const saveSession = new PptxSaveStateBuilder()
			.withZip(this.zip)
			.withCommentAuthorMap(this.commentAuthorMap)
			.withCommentAuthorDetails(this.commentAuthorDetails)
			.withCommentAuthorsRootXml(this.commentAuthorsRootXml)
			.withEmuPerPx(PptxHandlerRuntime.EMU_PER_PX)
			.build();
		const slideReferenceRemap = await this.reconcilePresentationSlidesForSave({
			slides,
			saveSession,
			slideRelationshipType,
			slideLayoutRelationshipType,
			relationshipsNamespace,
		});
		await this.ensureNotesMasterForAuthoredNotes(slides, saveConstants);
		await this.ensureHandoutMasterInfrastructure(options?.handoutMaster, saveConstants);

		// Process each slide (this may embed new media files that register
		// extensions in usedMediaPaths, so content-types must be updated after).
		for (const slide of slides) {
			await this.processSlideForSave(slide, saveSession, saveConstants);
		}

		// Update [Content_Types].xml with slide overrides and media Defaults.
		// This runs AFTER slide processing so that newly-embedded media (e.g. a
		// user-inserted GIF) is already registered in usedMediaPaths.
		const contentTypesXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (contentTypesXml) {
			const contentTypesData = this.parser.parse(contentTypesXml) as XmlObject;
			this.contentTypesBuilder.applySlideAndMediaUpdates({
				contentTypesData,
				slidePaths: slides.map((slide) => slide.id),
				usedMediaPaths: saveSession.getUsedMediaPaths(),
				usedInkPaths: saveSession.getUsedInkPaths(),
				slideContentType,
			});
			this.zip.file('[Content_Types].xml', this.builder.build(contentTypesData));
		}

		// ── Post-processing ──────────────────────────────────────

		// Clean up removed comment parts
		for (const existingCommentPath of saveSession.getExistingCommentPaths()) {
			if (saveSession.isCommentPathActive(existingCommentPath)) {
				continue;
			}
			this.zip.remove(existingCommentPath);
		}

		// Comment authors
		const hasCommentAuthors = saveSession.hasUsedCommentAuthors();
		if (hasCommentAuthors) {
			this.zip.file(
				'ppt/commentAuthors.xml',
				this.builder.build(
					this.commentAuthorsXmlFactory.createXmlElement({
						saveState: saveSession,
						conformance: effectiveConformance,
					}),
				),
			);
		} else {
			this.zip.remove('ppt/commentAuthors.xml');
			// Strip the matching Relationship from presentation.xml.rels; otherwise
			// the dangling reference causes PowerPoint to flag the file as corrupted
			// and prompt the user to repair it on open.
			await this.stripPresentationCommentAuthorsRelationship();
		}

		// Update content types for comments
		const contentTypesXmlAfterComments = await this.zip
			.file('[Content_Types].xml')
			?.async('string');
		if (contentTypesXmlAfterComments) {
			const contentTypesData = this.parser.parse(contentTypesXmlAfterComments) as XmlObject;
			this.contentTypesBuilder.applyCommentUpdates({
				contentTypesData,
				activeCommentPaths: saveSession.getActiveCommentPaths(),
				hasCommentAuthors,
				commentContentType,
				commentAuthorContentType,
				commentAuthorsPartName,
			});
			this.zip.file('[Content_Types].xml', this.builder.build(contentTypesData));
		}
		const modernPackage = await persistModernCommentPackage({
			slides,
			zip: this.zip,
			parser: this.parser,
			xmlBuilder: this.builder,
			authors: Array.from(this.modernCommentAuthors.values()),
			authorRoot: this.modernCommentAuthorsRootXml,
			authorPartPath: this.modernCommentAuthorsPartPath,
			authorRelationshipId: this.modernCommentAuthorsRelationshipId,
		});
		this.modernCommentAuthorsPartPath = modernPackage.authorPartPath;
		this.modernCommentAuthorsRelationshipId = modernPackage.authorRelationshipId;

		// Apply typed-model mutations to cached master / layout XmlObjects
		// before the passthrough flush. Masters / layouts not listed in the
		// save options keep their original parsed XML and round-trip
		// verbatim. (Slide master / layout writers — ECMA-376 §19.3.1.42 /
		// §19.3.1.40.)
		this.applySlideMasterChanges(options?.slideMasters);
		this.applySlideLayoutChanges(options?.slideLayouts);
		// Header & Footer. Runs AFTER the per-master writer so an explicit
		// `slideMasters[n].headerFooter` stays the more specific instruction
		// only where the dialog said nothing.
		this.applyPresentationHeaderFooter(options?.headerFooter);
		// Slide Master view shape-tree edits. Rewrites only the parts whose
		// element list differs from the one parsed at load, so an untouched
		// master keeps its verbatim passthrough below.
		await this.applySlideMasterElementChanges(
			options?.slideMasters,
			options?.slideLayouts,
			saveSession,
			saveConstants,
		);

		// Persist template/master updates. `withTemplateSpTreeOrder` puts the
		// shape tree back into document order (= paint order) on a clone; both
		// the passthrough and the rebuilt-from-elements route reach the ZIP
		// tag-bucketed otherwise.
		for (const [layoutPath, layoutXmlObj] of this.layoutXmlMap.entries()) {
			const ordered = await this.withTemplateSpTreeOrder(layoutPath, layoutXmlObj, 'p:sldLayout');
			this.zip.file(layoutPath, this.builder.build(ordered));
		}
		for (const [masterPath, masterXmlObj] of this.masterXmlMap.entries()) {
			const ordered = await this.withTemplateSpTreeOrder(masterPath, masterXmlObj, 'p:sldMaster');
			this.zip.file(masterPath, this.builder.build(ordered));
		}

		// Theme parts. Re-emit dirty themes from in-memory state; clean themes
		// remain at their original ZIP entries (passthrough). Phase 4 Stream A
		// / C-H3.
		await this.persistThemeParts();

		// Re-embed fonts (must run before presentation XML is serialized
		// because it modifies p:embeddedFontLst on presentationData)
		await this.applyEmbeddedFontPreservation(options?.embeddedFonts, options?.embeddedFontList);

		// Presentation save.
		//
		// A slide-size edit is adopted into the runtime state BEFORE the
		// builder runs, so a second save of the same handler (and every
		// EMU-derived consumer such as the layout previews) sees the new
		// dimensions rather than the ones the file was loaded with.
		if (options?.slideSize) {
			this.adoptSlideSize(options.slideSize);
		}
		if (this.presentationData) {
			this.presentationSaveBuilder.applySaveOptions({
				presentationData: this.presentationData,
				options: {
					headerFooter: options?.headerFooter,
					presentationProperties: options?.presentationProperties,
					customShows: options?.customShows,
					sections: options?.sections,
					photoAlbum: options?.photoAlbum,
					kinsoku: options?.kinsoku,
					modifyVerifier: options?.modifyVerifier,
					slideSize: options?.slideSize,
				},
				rawSlideWidthEmu: this.rawSlideWidthEmu,
				rawSlideHeightEmu: this.rawSlideHeightEmu,
				rawSlideSizeType: this.rawSlideSizeType,
				xmlLookupService: this.xmlLookupService,
				slideReferenceRemap,
			});
			this.deduplicateExtensionLists(this.presentationData);
			// Keep the `conformance` attribute consistent with the effective class.
			// A file loaded as Strict carries conformance="strict" on its root; when
			// the save downgrades to Transitional we must drop it (a Transitional
			// document with conformance="strict" is self-contradictory). The Strict
			// case sets it during convertZipToStrictConformance.
			if (effectiveConformance === 'transitional') {
				const presentationNode = this.presentationData['p:presentation'] as XmlObject | undefined;
				if (presentationNode && '@_conformance' in presentationNode) {
					delete presentationNode['@_conformance'];
				}
			}
			const presentationXml = this.builder.build(this.presentationData);
			this.zip.file('ppt/presentation.xml', presentationXml);
		}
		// Bridge a handout master's slides-per-page into the typed print
		// properties, but only when the caller has not supplied its own
		// `printProperties` (an explicit value, including `null` for removal,
		// always wins over the handout master's inferred layout).
		const handoutSlidesPerPage = options?.handoutMaster?.slidesPerPage;
		const presentationProperties =
			handoutSlidesPerPage !== undefined &&
			options?.presentationProperties?.printProperties === undefined
				? {
						...options?.presentationProperties,
						printProperties: {
							printWhat: slidesPerPageToPrintOutput(handoutSlidesPerPage),
						},
					}
				: options?.presentationProperties;
		await this.applyPresentationPropertiesPart(presentationProperties);
		// Default the view properties from the model parsed at load time (issue
		// #90) so an unmodified load -> save round-trips the typed viewProps and
		// edits still persist when the caller does not override them.
		await this.applyViewPropertiesPart(options?.viewProperties ?? this.loadedViewProperties);
		await this.applyTableStylesPart(options?.tableStyles);

		await this.documentPropertiesUpdater.updateOnSave(slides, {
			coreProperties: options?.coreProperties,
			appProperties: options?.appProperties,
			customProperties: options?.customProperties,
		});

		await this.applyTagCollectionChanges(options?.tags);
		await this.applyNotesMasterChanges(options?.notesMaster);
		await this.applyNotesMasterStructuralChanges(options?.notesMaster, saveSession, saveConstants);
		await this.applyHandoutMasterChanges(options?.handoutMaster);
		await this.applyHandoutMasterStructuralChanges(
			options?.handoutMaster,
			saveSession,
			saveConstants,
		);
		await this.processPendingChartUpdates();
		await this.ensureChartPartContentTypes();
		await this.ensureOleEmbeddingContentTypes();
		await this.ensureDiagramPartContentTypes();
		await this.processPendingSmartArtUpdates();
		this.applyCustomXmlPartsPreservation();

		// Update content types for custom XML parts
		if (this.customXmlParts.length > 0) {
			const contentTypesXmlForCustomXml = await this.zip
				.file('[Content_Types].xml')
				?.async('string');
			if (contentTypesXmlForCustomXml) {
				const contentTypesData = this.parser.parse(contentTypesXmlForCustomXml) as XmlObject;
				this.contentTypesBuilder.applyCustomXmlUpdates({
					contentTypesData,
					customXmlParts: this.customXmlParts,
				});
				this.zip.file('[Content_Types].xml', this.builder.build(contentTypesData));
			}
		}
		await this.applyCustomerDataChanges(options?.customerData, slides);

		this.applyThumbnailPreservation();
		await this.applyVbaProjectPreservation();
		await this.stripDigitalSignatures();

		const outputFormat = options?.outputFormat ?? 'pptx';
		await this.applyOutputFormatOverrides(outputFormat);

		// ── Strict conformance conversion ────────────────────────
		// If the effective conformance is Strict, we need to convert all
		// the XML parts in the ZIP from Transitional namespace URIs back
		// to Strict URIs before generating the final output.
		if (effectiveConformance === 'strict') {
			await this.convertZipToStrictConformance();
		}

		// Strip ZIP directory/folder entries. JSZip auto-creates a `dir: true`
		// entry for every intermediate path segment whenever `.file('a/b/c', …)`
		// is called, but ISO/IEC 29500-2 §10.1.1 states that a ZIP item
		// representing an OPC part must map one-to-one to a part URI — folder
		// entries are not parts. PowerPoint's OPC loader rejects them and
		// triggers the file-corruption / repair dialog on open, even though
		// schema validation passes (validators iterate logical parts, so they
		// never see directory entries).
		for (const name of Object.keys(this.zip.files)) {
			if (this.zip.files[name].dir) {
				delete this.zip.files[name];
			}
		}

		// JSZip defaults to STORE, which writes every part verbatim and turns a
		// 4.9 MB deck into 7.5 MB on a no-op open-and-save. PowerPoint DEFLATEs
		// its own packages, so matching it keeps the file the user downloads the
		// same size as the one they opened. Level 6 is zlib's default: the knee
		// of the ratio/time curve, and near-free next to the XML re-serialization
		// that already dominates a save.
		return await this.zip.generateAsync({
			type: 'uint8array',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 },
		});
	}

	/**
	 * Apply the Header & Footer dialog's state to every slide master.
	 *
	 * `p:hf` is not a legal child of `p:presentation`, so the option used to
	 * be dropped on the floor and the dialog was decorative. "Apply to All"
	 * means the slide masters, which is where PowerPoint keeps both the flags
	 * and the footer/date text.
	 */
	private applyPresentationHeaderFooter(headerFooter: PptxHeaderFooter | undefined): void {
		if (!headerFooter || Object.keys(headerFooter).length === 0) {
			return;
		}
		for (const [masterPath, masterXmlObj] of this.masterXmlMap.entries()) {
			const root = masterXmlObj['p:sldMaster'];
			if (typeof root !== 'object' || root === null) {
				continue;
			}
			applyHeaderFooterToMaster(root as XmlObject, headerFooter);
			this.masterXmlMap.set(masterPath, masterXmlObj);
		}
	}

	/**
	 * Adopt a requested `p:sldSz` into the runtime's load-time state.
	 *
	 * `rawSlideWidthEmu` / `rawSlideHeightEmu` / `rawSlideSizeType` used to be
	 * write-once-at-load, which is why a Slide Size edit could never reach the
	 * file: the builder wrote the load-time values straight back.
	 */
	private adoptSlideSize(slideSize: PptxSlideSize): void {
		if (slideSize.widthEmu !== undefined && slideSize.widthEmu > 0) {
			this.rawSlideWidthEmu = slideSize.widthEmu;
		}
		if (slideSize.heightEmu !== undefined && slideSize.heightEmu > 0) {
			this.rawSlideHeightEmu = slideSize.heightEmu;
		}
		if (slideSize.type !== undefined) {
			this.rawSlideSizeType = slideSize.type.length > 0 ? slideSize.type : undefined;
		}
	}

	/**
	 * Remove any Relationship in presentation.xml.rels whose Type matches either
	 * the Transitional or Strict commentAuthors relationship URI.
	 */
	private async stripPresentationCommentAuthorsRelationship(): Promise<void> {
		const relsPath = 'ppt/_rels/presentation.xml.rels';
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return;
		}
		const relsData = this.parser.parse(relsXml) as XmlObject;
		const root = relsData['Relationships'] as XmlObject | undefined;
		if (!root) {
			return;
		}
		const relationships = this.ensureArray(root['Relationship']) as XmlObject[];
		const filtered = relationships.filter((relationship) => {
			const type = String(relationship?.['@_Type'] ?? '');
			return (
				type !==
					'http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors' &&
				type !== 'http://purl.oclc.org/ooxml/officeDocument/relationships/commentAuthors'
			);
		});
		if (filtered.length === relationships.length) {
			return;
		}
		root['Relationship'] = filtered;
		this.zip.file(relsPath, this.builder.build(relsData));
	}
}
