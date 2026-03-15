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
  addSmartArtNodeAsChild,
  removeSmartArtNode,
  updateSmartArtNodeText,
  reorderSmartArtNode,
  reorderSmartArtNodeToIndex,
  promoteSmartArtNode,
  demoteSmartArtNode,
  resetSmartArtEditCounter,
  reflowSmartArtLayout,
  type ReflowedNodePosition,
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
  decryptPptx,
  encryptPptx,
  verifyPassword,
  IncorrectPasswordError,
  DataIntegrityError,
  type EncryptionInfo,
  type StandardEncryptionInfo,
  type EncryptionAlgorithm,
  type EncryptionOptions,
} from "./ooxml-crypto";

export {
  parseOle2,
  buildOle2,
  Ole2ParseError,
  type Ole2File,
  type Ole2DirectoryEntry,
} from "./ole2-parser";

export {
  verifyModifyPassword,
  createModifyVerifier,
} from "./modify-verifier";

export {
  detectDigitalSignatures,
  getSignaturePathsToStrip,
  parseSignatureXml,
  verifySignatureDigests,
  DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
  type SignatureDetectionResult,
  type SignatureCertificateInfo,
  type SignatureStatus,
  type ParsedSignature,
  type SignatureReference,
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

export { parseEmbeddedXlsx } from "./chart-xlsx-parser";

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
} from "emf-converter";

export {
  SWITCHABLE_LAYOUT_TYPES,
  switchSmartArtLayout,
  isSwitchableLayoutType,
} from "./smartart-layout-switch";

export {
  selectAlternateContentBranch,
  unwrapAlternateContent,
  areNamespacesSupported,
  isNamespaceSupported,
  getSupportedNamespaces,
  SHAPE_TREE_ELEMENT_TAGS,
} from "./alternate-content";

export {
  extractModel3DTransform,
  resolveModel3DMimeType,
  type Model3DTransform,
} from "./model3d-parser";

export {
  normalizeNamespaceUri,
  isStrictNamespaceUri,
  detectStrictConformance,
  normalizeStrictXml,
  toStrictNamespaceUri,
  isTransitionalNamespaceUri,
  convertXmlToStrict,
  type OoxmlConformanceClass,
} from "./strict-namespace-map";

export {
  VML_SHAPE_TAGS,
  parseVmlElement,
  parseVmlElements,
} from "./vml-parser";

export { parseActiveXControlsFromSlide } from "./activex-parser";

export { parseKinsoku, applyKinsokuToXml } from "./kinsoku-parser";

export {
  parseBodyPrBooleanAttrs,
  writeBodyPrBooleanAttrs,
} from "./body-properties-parser";

export {
  buildLinkedTextBoxChains,
  estimateTextBoxCapacity,
  distributeSegmentsAcrossChain,
  getLinkedTextBoxSegments,
  type LinkedTextBoxChainMember,
  type LinkedTextBoxChain,
  type LinkedTextBoxSegmentMap,
} from "./linked-text-box-utils";

export {
  isZoomElement as isZoomElementUtil,
  getZoomElements,
  isSummaryZoomSlide,
  getZoomTargetSlideIndexes,
  shouldReturnToZoomSlide,
  getSectionSlideRange,
} from "./zoom-utils";

export {
  FONT_SUBSTITUTION_MAP,
  PANOSE_FAMILY_MAP,
  PANOSE_SANS_SERIF_STYLES,
  PANOSE_MONOSPACE_PROPORTION,
  PANOSE_WEIGHT_MAP,
  parsePanoseString,
  parsePanoseBytes,
  classifyPanose,
  getPanoseWeight,
  getSubstituteFontFamily,
  getSubstituteFonts,
  hasDirectSubstitution,
  buildFontFamilyString,
} from "./font-substitution";

export {
  validatePptx,
  repairPptx,
  type ValidationIssue,
  type ValidationResult,
  type RepairResult,
} from "./pptx-validator";

export {
  reResolveSlideColors,
  applyThemeToData,
  buildThemeColorMap,
} from "./theme-switching";

export {
  computeSmartArtLayout,
  computeSnakeLayout,
  computeLinearLayout,
  computeHierarchyLayout,
  computeCycleLayout,
  computePyramidLayout,
  computeMatrixLayout,
  parseLayoutDefinition,
  layoutEngineShapesToDrawingShapes,
  type LayoutEngineShape,
  type LayoutConstraints,
  type ParsedLayoutDef,
  type LayoutAlgorithmType,
  type LayoutRule,
} from "./smartart-layout-engine";
