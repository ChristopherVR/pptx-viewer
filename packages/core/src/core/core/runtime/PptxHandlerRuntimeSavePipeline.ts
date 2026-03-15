import { XmlObject, PptxSlide } from "../../types";
import { PptxSaveStateBuilder } from "../builders";
import { createPptxSaveConstants } from "../factories";
import { type PptxHandlerSaveOptions } from "../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveSlideWriter";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  async save(
    slides: PptxSlide[],
    options?: PptxHandlerSaveOptions,
  ): Promise<Uint8Array> {
    const saveConstants = createPptxSaveConstants();
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
      .withEmuPerPx(PptxHandlerRuntime.EMU_PER_PX)
      .build();
    await this.reconcilePresentationSlidesForSave({
      slides,
      saveSession,
      slideRelationshipType,
      slideLayoutRelationshipType,
      relationshipsNamespace,
    });

    const contentTypesXml = await this.zip
      .file("[Content_Types].xml")
      ?.async("string");
    if (contentTypesXml) {
      const contentTypesData = this.parser.parse(contentTypesXml) as XmlObject;
      this.contentTypesBuilder.applySlideAndMediaUpdates({
        contentTypesData,
        slidePaths: slides.map((slide) => slide.id),
        usedMediaPaths: saveSession.getUsedMediaPaths(),
        slideContentType,
      });
      this.zip.file(
        "[Content_Types].xml",
        this.builder.build(contentTypesData),
      );
    }

    // Process each slide
    for (const slide of slides) {
      await this.processSlideForSave(slide, saveSession, saveConstants);
    }

    // ── Post-processing ──────────────────────────────────────

    // Clean up removed comment parts
    for (const existingCommentPath of saveSession.getExistingCommentPaths()) {
      if (saveSession.isCommentPathActive(existingCommentPath)) continue;
      this.zip.remove(existingCommentPath);
    }

    // Comment authors
    const hasCommentAuthors = saveSession.hasUsedCommentAuthors();
    if (hasCommentAuthors) {
      this.zip.file(
        "ppt/commentAuthors.xml",
        this.builder.build(
          this.commentAuthorsXmlFactory.createXmlElement({
            saveState: saveSession,
          }),
        ),
      );
    } else {
      this.zip.remove("ppt/commentAuthors.xml");
    }

    // Update content types for comments
    const contentTypesXmlAfterComments = await this.zip
      .file("[Content_Types].xml")
      ?.async("string");
    if (contentTypesXmlAfterComments) {
      const contentTypesData = this.parser.parse(
        contentTypesXmlAfterComments,
      ) as XmlObject;
      this.contentTypesBuilder.applyCommentUpdates({
        contentTypesData,
        activeCommentPaths: saveSession.getActiveCommentPaths(),
        hasCommentAuthors,
        commentContentType,
        commentAuthorContentType,
        commentAuthorsPartName,
      });
      this.zip.file(
        "[Content_Types].xml",
        this.builder.build(contentTypesData),
      );
    }

    // Persist template/master updates
    for (const [layoutPath, layoutXmlObj] of this.layoutXmlMap.entries()) {
      this.zip.file(layoutPath, this.builder.build(layoutXmlObj));
    }
    for (const [masterPath, masterXmlObj] of this.masterXmlMap.entries()) {
      this.zip.file(masterPath, this.builder.build(masterXmlObj));
    }

    // Presentation save
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
        },
        rawSlideWidthEmu: this.rawSlideWidthEmu,
        rawSlideHeightEmu: this.rawSlideHeightEmu,
        rawSlideSizeType: this.rawSlideSizeType,
        xmlLookupService: this.xmlLookupService,
      });
      this.deduplicateExtensionLists(this.presentationData);
      const presentationXml = this.builder.build(this.presentationData);
      this.zip.file("ppt/presentation.xml", presentationXml);
    }
    await this.applyPresentationPropertiesPart(options?.presentationProperties);

    await this.documentPropertiesUpdater.updateOnSave(slides, {
      coreProperties: options?.coreProperties,
      appProperties: options?.appProperties,
      customProperties: options?.customProperties,
    });

    await this.applyTagCollectionChanges(options?.tags);
    await this.applyNotesMasterChanges(options?.notesMaster);
    await this.applyHandoutMasterChanges(options?.handoutMaster);
    await this.processPendingChartUpdates();
    await this.processPendingSmartArtUpdates();
    this.applyCustomXmlPartsPreservation();

    // Update content types for custom XML parts
    if (this.customXmlParts.length > 0) {
      const contentTypesXmlForCustomXml = await this.zip
        .file("[Content_Types].xml")
        ?.async("string");
      if (contentTypesXmlForCustomXml) {
        const contentTypesData = this.parser.parse(
          contentTypesXmlForCustomXml,
        ) as XmlObject;
        this.contentTypesBuilder.applyCustomXmlUpdates({
          contentTypesData,
          customXmlParts: this.customXmlParts,
        });
        this.zip.file(
          "[Content_Types].xml",
          this.builder.build(contentTypesData),
        );
      }
    }

    this.applyThumbnailPreservation();
    await this.applyVbaProjectPreservation();
    await this.stripDigitalSignatures();

    const outputFormat = options?.outputFormat ?? "pptx";
    await this.applyOutputFormatOverrides(outputFormat);

    return await this.zip.generateAsync({ type: "uint8array" });
  }
}
