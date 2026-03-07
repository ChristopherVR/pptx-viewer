import JSZip from "jszip";
import { PptxElementXmlBuilder } from "../../builders/PptxElementXmlBuilder";
import {
  PptxColorStyleCodec,
  PptxCommentXmlFactoryProvider,
  PptxConnectorParser,
  PptxContentTypesBuilder,
  PptxElementTransformUpdater,
  PptxGraphicFrameParser,
  PptxMediaDataParser,
  PptxPresentationSaveBuilder,
  PptxPresentationSlidesReconciler,
  PptxShapeStyleExtractor,
  PptxSlideBackgroundBuilder,
  PptxSlideCommentPartWriter,
  PptxSlideMediaRelationshipBuilder,
  PptxSlideNotesPartUpdater,
  PptxTableDataParser,
} from "../builders";
import {
  PptxRuntimeDependencyFactory,
  type IPptxRuntimeDependencyFactory,
} from "../factories";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeLoadPipeline";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  public constructor(
    dependencyFactory: IPptxRuntimeDependencyFactory = new PptxRuntimeDependencyFactory(),
  ) {
    super();
    this.dependencyFactory = dependencyFactory;
    this.zip = new JSZip();
    this.parser = this.dependencyFactory.createParser();
    this.builder = this.dependencyFactory.createBuilder();
    this.elementXmlBuilder = new PptxElementXmlBuilder({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      toDrawingTextVerticalAlign: (value) =>
        this.textVerticalAlignToDrawingValue(value),
    });
    this.contentTypesBuilder = new PptxContentTypesBuilder();
    this.elementTransformUpdater = new PptxElementTransformUpdater();
    this.presentationSaveBuilder = new PptxPresentationSaveBuilder();
    this.presentationSlidesReconciler = new PptxPresentationSlidesReconciler();
    this.slideBackgroundBuilder = new PptxSlideBackgroundBuilder();
    this.slideCommentPartWriter = new PptxSlideCommentPartWriter();
    this.slideMediaRelationshipBuilder =
      new PptxSlideMediaRelationshipBuilder();
    this.slideNotesPartUpdater = new PptxSlideNotesPartUpdater();
    this.colorStyleCodec = new PptxColorStyleCodec({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      ensureArray: (value) => this.ensureArray(value),
      resolveThemeColor: (schemeKey) => this.resolveThemeColor(schemeKey),
    });
    this.connectorParser = new PptxConnectorParser({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      getOrderedSlidePaths: () => this.orderedSlidePaths,
      slideRelsMap: this.slideRelsMap,
      parseGeometryAdjustments: (prstGeom) =>
        this.parseGeometryAdjustments(prstGeom),
      readFlipState: (xfrm) => this.readFlipState(xfrm),
      extractShapeStyle: (spPr, styleNode) =>
        this.extractShapeStyle(spPr, styleNode),
      parseShapeLocks: (spLocks) => this.parseShapeLocks(spLocks),
      parseElementActions: (cNvPr, slideRelationships, orderedSlidePaths) =>
        this.parseElementActions(cNvPr, slideRelationships, orderedSlidePaths),
      parseConnectorTextBody: (txBody, slidePath) =>
        this.parseConnectorTextBody(txBody, slidePath),
    });
    this.shapeStyleExtractor = new PptxShapeStyleExtractor({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      parseColor: (colorNode, placeholderColor) =>
        this.parseColor(colorNode, placeholderColor),
      extractColorOpacity: (colorNode) => this.extractColorOpacity(colorNode),
      extractGradientFillColor: (gradFill) =>
        this.extractGradientFillColor(gradFill),
      extractGradientOpacity: (gradFill) =>
        this.extractGradientOpacity(gradFill),
      extractGradientFillCss: (gradFill) =>
        this.extractGradientFillCss(gradFill),
      extractGradientStops: (gradFill) => this.extractGradientStops(gradFill),
      extractGradientAngle: (gradFill) => this.extractGradientAngle(gradFill),
      extractGradientType: (gradFill) => this.extractGradientType(gradFill),
      extractGradientPathType: (gradFill) =>
        this.colorStyleCodec.extractGradientPathType(gradFill),
      extractGradientFocalPoint: (gradFill) =>
        this.colorStyleCodec.extractGradientFocalPoint(gradFill),
      normalizeStrokeDashType: (value) => this.normalizeStrokeDashType(value),
      normalizeConnectorArrowType: (value) =>
        this.normalizeConnectorArrowType(value),
      ensureArray: (value) => this.ensureArray(value),
      resolveThemeFillRef: (refNode, style) =>
        this.resolveThemeFillRef(refNode, style),
      resolveThemeLineRef: (refNode, style) =>
        this.resolveThemeLineRef(refNode, style),
      resolveThemeEffectRef: (refNode, style) =>
        this.resolveThemeEffectRef(refNode, style),
      extractShadowStyle: (shapeProps) => this.extractShadowStyle(shapeProps),
      extractInnerShadowStyle: (shapeProps) =>
        this.extractInnerShadowStyle(shapeProps),
      extractGlowStyle: (shapeProps) => this.extractGlowStyle(shapeProps),
      extractSoftEdgeStyle: (shapeProps) =>
        this.extractSoftEdgeStyle(shapeProps),
      extractReflectionStyle: (shapeProps) =>
        this.extractReflectionStyle(shapeProps),
      extractBlurStyle: (shapeProps) => this.extractBlurStyle(shapeProps),
      extractEffectDagStyle: (shapeProps) =>
        this.extractEffectDagStyle(shapeProps),
    });
    this.tableDataParser = new PptxTableDataParser({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      ensureArray: (value) => this.ensureArray(value),
      parseColor: (colorNode, placeholderColor) =>
        this.parseColor(colorNode, placeholderColor),
      extractGradientFillCss: (gradFill) =>
        this.extractGradientFillCss(gradFill),
      extractGradientStops: (gradFill) => this.extractGradientStops(gradFill),
      extractGradientType: (gradFill) => this.extractGradientType(gradFill),
      extractGradientAngle: (gradFill) => this.extractGradientAngle(gradFill),
      extractGradientPathType: (gradFill) =>
        this.colorStyleCodec.extractGradientPathType(gradFill),
      extractGradientFocalPoint: (gradFill) =>
        this.colorStyleCodec.extractGradientFocalPoint(gradFill),
    });
    this.mediaDataParser = new PptxMediaDataParser({
      slideRelsMap: this.slideRelsMap,
      resolvePath: (base, relative) => this.resolvePath(base, relative),
      getPathExtension: (pathValue) => this.getPathExtension(pathValue),
    });
    this.graphicFrameParser = new PptxGraphicFrameParser({
      emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
      getOrderedSlidePaths: () => this.orderedSlidePaths,
      slideRelsMap: this.slideRelsMap,
      readFlipState: (xfrm) => this.readFlipState(xfrm),
      parseTableData: (graphicData) => this.parseTableData(graphicData),
      parseMediaData: (graphicData, slidePath) =>
        this.parseMediaData(graphicData, slidePath),
      parseElementActions: (cNvPr, slideRelationships, orderedSlidePaths) =>
        this.parseElementActions(cNvPr, slideRelationships, orderedSlidePaths),
      inspectGraphicFrameCompatibility: (type, slidePath, elementId) =>
        this.compatibilityService.inspectGraphicFrameCompatibility(
          type,
          slidePath,
          elementId,
        ),
    });
    const commentXmlFactoryProvider = new PptxCommentXmlFactoryProvider();
    this.slideCommentsXmlFactory =
      commentXmlFactoryProvider.createSlideCommentsFactory();
    this.commentAuthorsXmlFactory =
      commentXmlFactoryProvider.createCommentAuthorsFactory();
    const dependencies = this.dependencyFactory.createDependencies({
      zip: this.zip,
      parser: this.parser,
      builder: this.builder,
      editorMetaExtensionUri: PptxHandlerRuntime.EDITOR_META_EXTENSION_URI,
      editorMetaNamespaceUri: PptxHandlerRuntime.EDITOR_META_NAMESPACE_URI,
      getXmlLocalName: (xmlKey) => {
        const withoutAttributePrefix = xmlKey.startsWith("@_")
          ? xmlKey.slice(2)
          : xmlKey;
        const separatorIndex = withoutAttributePrefix.lastIndexOf(":");
        if (separatorIndex < 0) return withoutAttributePrefix;
        return withoutAttributePrefix.slice(separatorIndex + 1);
      },
    });
    this.xmlLookupService = dependencies.xmlLookupService;
    this.compatibilityService = dependencies.compatibilityService;
    this.slideLoaderService = dependencies.slideLoaderService;
    this.templateBackgroundService = dependencies.templateBackgroundService;
    this.slideTransitionService = dependencies.slideTransitionService;
    this.editorAnimationService = dependencies.editorAnimationService;
    this.nativeAnimationService = dependencies.nativeAnimationService;
    this.animationWriteService = dependencies.animationWriteService;
    this.documentPropertiesUpdater = dependencies.documentPropertiesUpdater;
  }
}
