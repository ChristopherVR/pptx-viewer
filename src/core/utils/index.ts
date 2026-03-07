export {
  cloneTextStyle,
  cloneShapeStyle,
  cloneElement,
  cloneSlide,
  cloneTemplateElementsBySlideId,
  cloneXmlObject,
} from "./clone-utils";

export {
  isTemplateElement,
  isEditableTextElement,
  getElementLabel,
  shouldRenderFallbackLabel,
  getElementTextContent,
  createUniformTextSegments,
  createEditorId,
  createArrayBufferCopy,
  ensureArrayValue,
  formatCommentTimestamp,
  getCommentMarkerPosition,
  readFileAsDataUrl,
  createTemplateShapeRawXml,
  createTemplateConnectorRawXml,
  pptxActionToElementAction,
  elementActionToPptxAction,
  elementHasAction,
} from "./element-utils";

export {
  normalizeStrokeDashType,
  getCssBorderDashStyle,
  getSvgStrokeDasharray,
} from "./stroke-utils";

export { parseDataUrlToBytes, fetchUrlToBytes } from "./data-url-utils";

export {
  detectOleObjectType,
  inferOleExtensionFromTarget,
  getOleObjectTypeLabel,
} from "./ole-utils";

export {
  decomposeSmartArt,
  resetDecomposeCounter,
  type ContainerBounds,
} from "./smartart-decompose";

export {
  addSmartArtNode,
  removeSmartArtNode,
  updateSmartArtNodeText,
  reorderSmartArtNode,
  promoteSmartArtNode,
  demoteSmartArtNode,
  resetSmartArtEditCounter,
} from "./smartart-editing";

export {
  extractGuidFromPartName,
  guidToKey,
  deobfuscateFont,
  detectFontFormat,
} from "./font-deobfuscation";

export {
  COLOR_MAP_ALIAS_KEYS,
  DEFAULT_COLOR_MAP,
  buildClrMapOverrideXml,
  mergeThemeColorOverride,
  hasNonTrivialOverride,
  type ColorMapAliasKey,
} from "./theme-override-utils";

export {
  detectFileFormat,
  EncryptedFileError,
  type FileFormatDetection,
} from "./encryption-detection";

export {
  detectDigitalSignatures,
  getSignaturePathsToStrip,
  DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
  type SignatureDetectionResult,
} from "./signature-detection";

export {
  parseSeriesTrendlines,
  parseSeriesErrBars,
  parseDataTable,
  parseLineStyle,
} from "./chart-advanced-parser";

export {
  parseSeriesDataPoints,
  parseSeriesDataLabels,
  parseSeriesExplosion,
  parseMarker,
  parseShapeProps,
} from "./chart-series-detail-parser";

export {
  parseChartAxes,
  parseChart3DSurfaces,
} from "./chart-axis-parser";

export { parseCxChartSeries } from "./chart-cx-parser";

export {
  parseSlideDrawingGuides,
  parsePresentationDrawingGuides,
  guideEmuToPx,
  guidePxToEmu,
  buildGuideListExtension,
  P14_GUIDE_URI,
  P15_GUIDE_URI,
} from "./guide-utils";

export {
  convertEmfToDataUrl,
  convertWmfToDataUrl,
} from "./emf-converter";
