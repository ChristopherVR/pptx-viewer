export {
	cloneTextStyle,
	cloneShapeStyle,
	cloneElement,
	cloneSlide,
	cloneTemplateElementsBySlideId,
	cloneXmlObject,
} from './clone-utils';
export {
	applyCustomShows,
	applySections,
	parseCustomShows,
	type PptxSlideReferenceRemap,
} from './presentation-collections';

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
} from './element-utils';

export { createTemplateShapeRawXml, createTemplateConnectorRawXml } from './element-xml-builders';

export {
	extractColorChoiceXml,
	colorsEqual,
	buildSrgbColorChoice,
	serializeColorChoice,
} from './color-xml-preservation';

export {
	pptxActionToElementAction,
	elementActionToPptxAction,
	elementHasAction,
} from './element-actions';

export {
	normalizeStrokeDashType,
	getCssBorderDashStyle,
	getSvgStrokeDasharray,
} from './stroke-utils';

export { parseDataUrlToBytes, fetchUrlToBytes } from './data-url-utils';
export { buildInkMlContent, parseInkMlContent } from './inkml-content-part';

export { stripParentDirSegments } from './strip-parent-dir-segments';

export {
	detectOleObjectType,
	inferOleExtensionFromTarget,
	getOleObjectTypeLabel,
	mimeTypeForOleFile,
} from './ole-utils';

export {
	unwrapOleEmbedding,
	decodeOle10Native,
	isOle2CompoundFile,
	oleBytesToDataUrl,
	type OleUnwrapResult,
} from './ole-embedded-extract';

export { decomposeSmartArt } from './smartart-decompose';

export {
	parseDiagramRelationshipIds,
	applyDiagramRelationshipIds,
	type DiagramRelationshipIds,
} from './diagram-relationship-ids';

export { resetDecomposeCounter, type ContainerBounds } from './smartart-helpers';

export {
	addSmartArtNode,
	addSmartArtNodeAsChild,
	removeSmartArtNode,
	updateSmartArtNodeText,
	reorderSmartArtNode,
	reorderSmartArtNodeToIndex,
	promoteSmartArtNode,
	demoteSmartArtNode,
	setSmartArtNodeStyle,
	resetSmartArtEditCounter,
	reflowSmartArtLayout,
	type ReflowedNodePosition,
} from './smartart-editing';

export {
	extractGuidFromPartName,
	guidToKey,
	deobfuscateFont,
	obfuscateFont,
	generateFontGuid,
	detectFontFormat,
} from './font-deobfuscation';

export {
	COLOR_MAP_ALIAS_KEYS,
	DEFAULT_COLOR_MAP,
	buildClrMapOverrideXml,
	mergeThemeColorOverride,
	hasNonTrivialOverride,
	themeColorSchemesEqual,
	type ColorMapAliasKey,
} from './theme-override-utils';

export {
	detectFileFormat,
	EncryptedFileError,
	type FileFormatDetection,
} from './encryption-detection';

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
} from './ooxml-crypto';

export {
	parseOle2,
	buildOle2,
	Ole2ParseError,
	type Ole2File,
	type Ole2DirectoryEntry,
} from './ole2-parser';

export { verifyModifyPassword, createModifyVerifier } from './modify-verifier';

export {
	detectDigitalSignatures,
	getSignaturePathsToStrip,
	parseSignatureXml,
	verifySignatureDigests,
	type SignatureDetectionResult,
	type SignatureCertificateInfo,
	type SignatureStatus,
	type ParsedSignature,
	type SignatureReference,
} from './signature-detection';

export {
	DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
	DIGITAL_SIGNATURE_REL_TYPE,
	PPTX_VIEWER_MANIFEST_NS,
	XMLDSIG_NS,
	OPC_RELATIONSHIP_TRANSFORM,
	XML_TRANSFORM_ENVELOPED_SIGNATURE,
	SUPPORTED_XML_CANON_TRANSFORMS,
	ENTERPRISE_TRUST_ROOTS_FILE_ENV,
	ENTERPRISE_TRUST_ROOTS_PEM_ENV,
	ENTERPRISE_REQUIRE_REVOCATION_ENV,
	ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV,
	ENTERPRISE_REQUIRE_TIMESTAMP_ENV,
	DIGEST_ALGORITHM_TO_HASH,
	DIGEST_ALGORITHM_TO_WEB_CRYPTO,
} from './signature-constants';

export type {
	CertificateRevocationStatus,
	TimestampAuthorityStatus,
	SignatureReferenceCheck,
	SignatureCertificateInfo as SignatureNodeCertificateInfo,
	SignatureDetailStatus,
	SignatureDetail,
	DigitalSignatureVerificationStatus,
	DigitalSignatureReport,
	SignOptions,
	SignResult,
	LoadedSigningMaterial,
	ParsedReferenceTransform,
	ReferenceTransformResult,
	SignatureValidationPolicy,
	OfficeSignatureReference,
} from './signature-types';

export {
	escapeXmlAttr,
	escapeXmlText,
	isValidBase64,
	extractTagAttribute,
	extractFirstTagText,
	extractAllTagText,
} from './signature-xml-utils';

export { normalizePartPath, resolveReferenceUriToPart } from './signature-reference-utils';

export { computeDigestBase64 as computeDigestBase64WebCrypto } from './signature-digest';

export { decodeXmlEntities } from './xml-entities';

export { computeDetailStatus, computeVerificationStatus } from './signature-inspection-status';

export {
	parseSeriesTrendlines,
	parseSeriesErrBars,
	parseDataTable,
	parseLineStyle,
} from './chart-advanced-parser';

export {
	parseSeriesDataPoints,
	parseSeriesDataLabels,
	parseSeriesExplosion,
	parseMarker,
	parseShapeProps,
} from './chart-series-detail-parser';

export { parseChartAxes, parseChart3DSurfaces } from './chart-axis-parser';

export { parseCxChartSeries } from './chart-cx-parser';

export { parseEmbeddedXlsx } from './chart-xlsx-parser';

export {
	chartDataAddSeries,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
	chartDataChangeType,
	chartDataAddCategory,
	chartDataRemoveCategory,
} from './chart-data-utils';

export {
	parseSlideDrawingGuides,
	parsePresentationDrawingGuides,
	guideEmuToPx,
	guidePxToEmu,
	buildGuideListExtension,
	P14_GUIDE_URI,
	P15_GUIDE_URI,
} from './guide-utils';

export { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';

export {
	SWITCHABLE_LAYOUT_TYPES,
	switchSmartArtLayout,
	isSwitchableLayoutType,
} from './smartart-layout-switch';

export {
	selectAlternateContentBranch,
	unwrapAlternateContent,
	areNamespacesSupported,
	isAlternateContentChoiceSupported,
	isAlternateContentChoiceXmlSupported,
	isNamespaceSupported,
	getSupportedNamespaces,
	SHAPE_TREE_ELEMENT_TAGS,
	type AlternateContentBlock,
} from './alternate-content';

export {
	extractModel3DTransform,
	resolveModel3DMimeType,
	type Model3DTransform,
} from './model3d-parser';

export {
	normalizeNamespaceUri,
	isStrictNamespaceUri,
	detectStrictConformance,
	normalizeStrictXml,
	toStrictNamespaceUri,
	isTransitionalNamespaceUri,
	convertXmlToStrict,
	type OoxmlConformanceClass,
} from './strict-namespace-map';

export { VML_SHAPE_TAGS, parseVmlElement, parseVmlElements } from './vml-parser';

export { parseActiveXControlsFromSlide } from './activex-parser';
export { applyActiveXControlsToSlide, buildActiveXControlNode } from './activex-serializer';

export { parseKinsoku, applyKinsokuToXml } from './kinsoku-parser';

export { parseBodyPrBooleanAttrs, writeBodyPrBooleanAttrs } from './body-properties-parser';

export {
	buildLinkedTextBoxChains,
	estimateTextBoxCapacity,
	distributeSegmentsAcrossChain,
	getLinkedTextBoxSegments,
	type LinkedTextBoxChainMember,
	type LinkedTextBoxChain,
	type LinkedTextBoxSegmentMap,
} from './linked-text-box-utils';

export {
	isZoomElement as isZoomElementUtil,
	getZoomElements,
	isSummaryZoomSlide,
	getZoomTargetSlideIndexes,
	shouldReturnToZoomSlide,
	getSectionSlideRange,
} from './zoom-utils';

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
} from './font-substitution';

export {
	validatePptx,
	repairPptx,
	type ValidationIssue,
	type ValidationResult,
	type RepairResult,
} from './pptx-validator';

export { reResolveSlideColors, applyThemeToData, buildThemeColorMap } from './theme-switching';
export { applyThemeOverrideToSlide } from './slide-theme-override';

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
} from './smartart-layout-engine';

export {
	applySmartArtLayoutDefinition,
	parseSmartArtLayoutDefinition,
	validateSmartArtLayoutDefinition,
} from './smartart-layout-definition';

export {
	parseSmartArtColorStyleLabels,
	parseSmartArtDefinitionMetadata,
	parseSmartArtQuickStyleLabels,
	validateSmartArtColorStyleLabels,
	validateSmartArtDefinitionMetadata,
} from './smartart-definition-metadata';

export {
	checkPresentation,
	checkMissingAltText,
	checkMissingSlideTitle,
	checkLowContrast,
	checkComplexTables,
	checkDuplicateTitles,
	checkBlankSlide,
	computeContrastRatio,
	parseHexColor,
	relativeLuminance,
	type AccessibilityIssue,
	type AccessibilityIssueType,
	type AccessibilityIssueSeverity,
	type AccessibilityCheckOptions,
} from './accessibility-checker';

export {
	findCustomShow,
	resolveCustomShowSlideIndices,
	getCustomShowNames,
	navigateCustomShow,
	getCustomShowPositionLabel,
} from './custom-show-utils';

export {
	resolveTableCellStyle,
	mergeStyleParts,
	type ParsedTableStylePart,
	type ParsedTableStyle,
	type TableStyleFlags,
	type TableStylePartFill,
	type TableStylePartBorders,
	type TableStylePartBorder,
	type TableStylePartText,
} from './table-style-resolver';

export {
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	EMPHASIS_PRESETS,
	MOTION_PATH_PRESETS,
	ALL_ANIMATION_PRESETS,
	getAnimationPresetInfo,
	getPresetsByCategory,
	getNativeAnimationPresetMetadata,
	type AnimationCategory,
	type AnimationPresetInfo,
} from './animation-preset-catalog';

export { relayoutSmartArt } from './smartart-relayout';

export { resolveLayoutDisplayName, type LayoutDisplayNameInput } from './layout-display-name';

export {
	reorderObjectKeys,
	EFFECT_LST_ORDER,
	SP_PR_ORDER,
	TC_PR_BORDERS_ORDER,
	BLIP_FILL_ORDER,
} from './xml-reorder';

export {
	xmlChild,
	xmlChildren,
	xmlAttr,
	xmlAttrNumber,
	xmlAttrBool,
	xmlText,
	xmlPath,
	isXmlNode,
} from './xml-access';

export {
	parseChartManualLayout,
	parseChartLayouts,
	applyChartManualLayout,
	applyChartLayouts,
} from './chart-layout';

export { parseBubbleChartOptions, applyBubbleChartOptions } from './chart-bubble-options';
export {
	SMART_ART_DEFINITION_PARTS,
	parseSmartArtDefinitionHeaderList,
	serializeSmartArtDefinitionHeaderList,
	validateSmartArtDefinitionHeaderList,
} from './smartart-definition-header';
export {
	applySmartArtConstraintRules,
	parseSmartArtConstraintRules,
	validateSmartArtConstraintRules,
} from './smartart-constraint-rules';
export { parseChartUpDownBars, applyChartUpDownBars } from './chart-up-down-bars';

export {
	parseDrawingMediaReference,
	applyDrawingMediaReference,
	type ParsedDrawingMediaReference,
} from './drawing-media-reference';
export { parseDrawingLineDash, applyDrawingLineDash } from './drawing-line-dash';
export { extractStyleReferenceColorXml, withThemePlaceholderColor } from './theme-style-reference';

export { deriveSlideTitle, deriveSlideTitles } from './slide-title';
