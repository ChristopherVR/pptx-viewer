import {
  PptxData,
  PptxSlide,
  type PptxSection,
  type PptxLayoutOption,
  PptxCompatibilityWarning,
  XmlObject,
} from "../../types";
import { PptxLoadDataBuilder } from "../builders";
import { type PptxHandlerLoadOptions } from "../types";
import { PptxXmlBuilder } from "../../builders/fluent";
import { parsePresentationDrawingGuides } from "../../utils/guide-utils";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeLoadSession";

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
  ): Promise<PptxData> {
    const headerFooter = this.extractHeaderFooter();
    const presentationProperties = await this.parsePresentationProperties();
    const customShows = this.parseCustomShows();
    const tableStyleMap = await this.parseTableStyles();
    const embeddedFonts = await this.getEmbeddedFonts();
    const themeOptions = await this.parseThemeOptions();
    const notesMaster = await this.parseNotesMaster();
    const handoutMaster = await this.parseHandoutMaster();
    const slideMasters = await this.parseSlideMasters();
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
      .withNotesDimensions(
        presentationState.notesWidthEmu,
        presentationState.notesHeightEmu,
      )
      .withSlides(slidesWithWarnings)
      .withLayoutOptions(this.getLayoutOptions())
      .withHeaderFooter(headerFooter)
      .withPresentationProperties(presentationProperties)
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
      .withMruColors(presentationProperties?.mruColors)
      .withNotesMaster(notesMaster)
      .withHandoutMaster(handoutMaster)
      .withSlideMasters(slideMasters.length > 0 ? slideMasters : undefined)
      .withTags(tags.length > 0 ? tags : undefined)
      .withCustomProperties(
        customProperties.length > 0 ? customProperties : undefined,
      )
      .withCoreProperties(coreProperties)
      .withAppProperties(appProperties)
      .withHasMacros(this.vbaProjectBin !== null ? true : undefined)
      .withHasDigitalSignatures(
        this.signatureDetection?.hasSignatures || undefined,
      )
      .withDigitalSignatureCount(
        this.signatureDetection?.signatureCount &&
          this.signatureDetection.signatureCount > 0
          ? this.signatureDetection.signatureCount
          : undefined,
      )
      .withPresentationGuides(
        presentationGuides.length > 0 ? presentationGuides : undefined,
      )
      .withPhotoAlbum(photoAlbum)
      .withKinsoku(kinsoku)
      .withModifyVerifier(modifyVerifier)
      .withCustomXmlParts(
        this.customXmlParts.length > 0 ? this.customXmlParts : undefined,
      )
      .withCustomerData(
        customerData.length > 0 ? customerData : undefined,
      )
      .withSlideSizeType(this.rawSlideSizeType)
      .withThumbnailData(this.thumbnailData ?? undefined)
      .withCommentAuthors(
        this.commentAuthorDetails.size > 0
          ? Array.from(this.commentAuthorDetails.values())
          : undefined,
      )
      .build();
  }

  /**
   * Walk the raw XML of every slide to find the highest numeric `@_id`
   * attribute on `p:cNvPr` / `p:cNvCxnSpPr` / `p:cNvPicPr` nodes.
   * This is used to seed the element builder's ID counter so that
   * new elements never collide with existing ones.
   */
  protected findMaxElementId(slides: PptxSlide[]): number {
    let max = 0;
    const visit = (node: unknown): void => {
      if (node === null || node === undefined || typeof node !== "object")
        return;
      const obj = node as Record<string, unknown>;
      if ("@_id" in obj) {
        const id = parseInt(String(obj["@_id"]), 10);
        if (Number.isFinite(id) && id > max) {
          max = id;
        }
      }
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            visit(item);
          }
        } else if (typeof value === "object" && value !== null) {
          visit(value);
        }
      }
    };
    for (const slide of slides) {
      visit(slide.rawXml);
    }
    return max;
  }

  protected resetElementIdCounter(slides: PptxSlide[]): void {
    const maxExistingId = this.findMaxElementId(slides);
    this.elementXmlBuilder.resetIdCounter(maxExistingId + 1);
  }

  protected attachSlideWarnings(slides: PptxSlide[]): PptxSlide[] {
    const warnings = this.compatibilityService.getWarnings();
    return slides.map((slide) => ({
      ...slide,
      warnings: warnings.filter((warning) => warning.slideId === slide.id),
    }));
  }

  async load(
    data: ArrayBuffer,
    options: PptxHandlerLoadOptions = {},
  ): Promise<PptxData> {
    await this.initializeLoadSession(data, options);
    await this.detectAndPreserveVbaProject();
    this.detectDigitalSignatureParts();
    await this.parseCustomXmlParts();
    const presentationState = await this.loadPresentationState();
    const slides = await this.loadSlidesForPresentation(
      presentationState.sectionBySlideId,
    );
    const slidesWithWarnings = this.attachSlideWarnings(slides);
    this.resetElementIdCounter(slides);
    return this.buildLoadData(presentationState, slidesWithWarnings);
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
  setTemplateBackground(
    path: string,
    backgroundColor: string | undefined,
  ): void {
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
  private findMasterPathForLayout(layoutPath: string): string | undefined {
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return undefined;
    for (const [, target] of layoutRels.entries()) {
      if (target.includes("slideMaster")) {
        const layoutDir = layoutPath.substring(
          0,
          layoutPath.lastIndexOf("/") + 1,
        );
        return target.startsWith("..")
          ? this.resolvePath(layoutDir, target)
          : "ppt/" + target.replace("../", "");
      }
    }
    return undefined;
  }

  /**
   * Find the master path for a slide by walking: slide -> layout -> master.
   */
  private findMasterPathForSlide(slidePath: string): string | undefined {
    const layoutPath = this.findLayoutPathForSlide(slidePath);
    if (!layoutPath) return undefined;
    return this.findMasterPathForLayout(layoutPath);
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
    if (!slide) return [];

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
      if (target.includes("slideLayout")) {
        const masterDir = masterPath.substring(
          0,
          masterPath.lastIndexOf("/") + 1,
        );
        const resolved = target.startsWith("..")
          ? this.resolvePath(masterDir, target)
          : "ppt/" + target.replace("../", "");
        masterLayoutPaths.add(resolved);
      }
    }

    // Build layout options from the filtered set
    const options: PptxLayoutOption[] = [];
    for (const lp of masterLayoutPaths) {
      const xmlObj = this.layoutXmlMap.get(lp);
      if (xmlObj) {
        const sldLayout = (xmlObj as XmlObject)["p:sldLayout"] as
          | XmlObject
          | undefined;
        const name =
          String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || lp;
        const type =
          sldLayout?.["@_type"] != null
            ? String(sldLayout["@_type"]).trim()
            : undefined;
        options.push({ path: lp, name, ...(type ? { type } : {}) });
      } else {
        // Layout not yet in cache -- try to load from ZIP
        try {
          const layoutXmlStr = await this.zip.file(lp)?.async("string");
          if (layoutXmlStr) {
            const layoutXmlObj = this.parser.parse(layoutXmlStr) as XmlObject;
            this.layoutXmlMap.set(lp, layoutXmlObj);
            const sldLayout = layoutXmlObj["p:sldLayout"] as
              | XmlObject
              | undefined;
            const name =
              String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || lp;
            const type =
              sldLayout?.["@_type"] != null
                ? String(sldLayout["@_type"]).trim()
                : undefined;
            options.push({ path: lp, name, ...(type ? { type } : {}) });
          }
        } catch {
          // Skip unreadable layouts
        }
      }
    }
    return options;
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
      const layoutXmlStr = await this.zip.file(layoutPath)?.async("string");
      if (!layoutXmlStr) {
        throw new Error(`Layout not found: ${layoutPath}`);
      }
      layoutXml = this.parser.parse(layoutXmlStr) as XmlObject;
      this.layoutXmlMap.set(layoutPath, layoutXml);
    }

    const slidePath = slide.id;

    // ── 1. Update the slide's .rels to point to the new layout ──────
    const slideRelsPath =
      slidePath.replace("slides/", "slides/_rels/") + ".rels";
    const relsXml = await this.zip.file(slideRelsPath)?.async("string");

    if (relsXml) {
      const relsData = this.parser.parse(relsXml);
      const rels = Array.isArray(relsData?.Relationships?.Relationship)
        ? relsData.Relationships.Relationship
        : relsData?.Relationships?.Relationship
          ? [relsData.Relationships.Relationship]
          : [];

      // Compute relative target from slide path to layout path
      const relativeTarget = "../slideLayouts/" + layoutPath.split("/").pop();

      let found = false;
      for (const r of rels) {
        const relType = String(r["@_Type"] || "");
        if (relType.includes("/slideLayout")) {
          r["@_Target"] = relativeTarget;
          found = true;
          break;
        }
      }

      if (!found) {
        // No existing layout rel -- add one
        const maxRId = rels.reduce((max: number, r: XmlObject) => {
          const id = parseInt(String(r["@_Id"] || "rId0").replace("rId", ""), 10);
          return Number.isFinite(id) && id > max ? id : max;
        }, 0);
        rels.push({
          "@_Id": `rId${maxRId + 1}`,
          "@_Type":
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
          "@_Target": relativeTarget,
        });
      }

      relsData.Relationships.Relationship =
        rels.length === 1 ? rels[0] : rels;
      const updatedRelsXml = this.builder.build(relsData);
      this.zip.file(slideRelsPath, updatedRelsXml);

      // Update the in-memory relationship map
      const relsMap = this.slideRelsMap.get(slidePath);
      if (relsMap) {
        for (const [rId, target] of relsMap.entries()) {
          if (target.includes("slideLayout")) {
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
    const sldLayout = (layoutXml as XmlObject)["p:sldLayout"] as
      | XmlObject
      | undefined;
    const layoutName =
      String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || layoutPath;

    // Try to resolve background from the new layout
    const layoutBgColor = this.extractBackgroundColor(
      layoutXml,
      "p:sldLayout",
    );

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
