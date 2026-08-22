export {
	cloneTextStyle,
	cloneShapeStyle,
	cloneElement,
	cloneSlide,
	cloneTemplateElementsBySlideId,
	cloneXmlObject,
	deepCloneData,
} from './clone-utils';
export {
	groupElements,
	ungroupElements,
	isTemplateElementId,
	makeStoreAwareId,
	reassignDescendantIds,
	type GroupResult,
	type UngroupOptions,
	type UngroupResult,
} from './group-ops';
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
	createDrawingObjectId,
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

export { ooxmlGradientAngleToCssDegrees, cssDegreesToOoxmlGradientAngle } from './gradient-angle';
export {
	normalizePositiveFixedAngleDegrees,
	positiveFixedAngleAttribute,
	shadowOffsetToDistanceAndDirection,
} from './positive-fixed-angle';

export { parseDataUrlToBytes, fetchUrlToBytes } from './data-url-utils';
export { buildInkMlContent, parseInkMlContent } from './inkml-content-part';
export type { ParsedInkMlContent } from './inkml-content-part';
export { inkBounds, inkLengthToPx, inkPointMapper } from './inkml-ink-space';
export type { InkBounds, InkTargetBox } from './inkml-ink-space';

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

export { decomposeSmartArt, computeSmartArtElementsWithoutCache } from './smartart-decompose';

export {
	parseDiagramRelationshipIds,
	applyDiagramRelationshipIds,
	type DiagramRelationshipIds,
} from './diagram-relationship-ids';

export {
	resetDecomposeCounter,
	buildForest,
	buildTree,
	treeWidth,
	treeDepth,
	type ContainerBounds,
	type TreeNode,
} from './smartart-helpers';

export {
	colour,
	nodeFill,
	nodeStroke,
	nodeTextStyle,
	nodeOpacity,
	styleShadow,
	styleStroke,
	truncate,
	fitFontSize,
	chevronPoints,
	gearPoints,
	strokeFor,
	flattenNodes,
} from './smartart-layout-style-helpers';

export type {
	LayoutRect,
	RenderedNodeTextStyle,
	RenderedNodeIdentity,
	RenderedRectNode,
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedNode,
	RenderedConnector,
	LayoutFamily,
	SmartArtLayoutResult,
	BoundingBox,
} from './smartart-layout-types';

export {
	rectNode,
	circleNode,
	polygonNode,
	styleContext,
	type StyleContext,
} from './smartart-layout-interpreter-render';

export {
	discoverArrangement,
	itemNode,
	findConstraint,
	ratioConstraint,
	clampByRules,
	algorithmParam,
	numericParam,
	resolveFlowDirection,
	type ArrangementKind,
	type ArrangementPlan,
	type FlowDirection,
} from './smartart-layout-interpreter-model';

export {
	buildConstraintIndex,
	resolveConstraint,
	resolveRatioConstraint,
	roleOf,
	hasReference,
	EMPTY_CONSTRAINT_INDEX,
	type ConstraintIndex,
} from './smartart-constraint-solver';
export { selectArrangedNodes, chooseAlgType } from './smartart-layout-interpreter-flow';
export { arrangeLinear, arrangeSnake } from './smartart-layout-interpreter-linear';
export { arrangeCycle } from './smartart-layout-interpreter-cycle';
export { arrangeHierarchy } from './smartart-layout-interpreter-hierarchy';
export { arrangePyramid } from './smartart-layout-interpreter-pyramid';
export { arrangeComposite } from './smartart-layout-interpreter-composite';
export { arrangeConn, arrangeSpacer, arrangeText } from './smartart-layout-interpreter-aux';
export { applyCustomLayoutOverrides } from './smartart-layout-interpreter-custom';
export { interpretSmartArtLayout, type InterpretLayoutInput } from './smartart-layout-interpreter';
export { parseSmartArtPointCustomLayout } from './smartart-data-model-attributes';
export { interpretedLayoutToElements } from './smartart-interpreter-drawing-bridge';
export { applySmartArtRoleColors, type SmartArtColorRoleMap } from './smartart-node-role-colors';
export { resolveSmartArtNodeStyleRoles } from './smartart-node-style-role';
export {
	resolveSmartArtEffectIntensity,
	type SmartArtEffectIntensity,
} from './smartart-effect-intensity';
export {
	buildSmartArtColorRoleMap,
	buildSmartArtColorLists,
	parseSmartArtColorListHexes,
	type SmartArtColorListDeps,
	type SmartArtColorLists,
} from './smartart-color-lists';

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

export { decodeXmlEntities, encodeXmlAttributeValue, encodeXmlTextValue } from './xml-entities';

export {
	preservesSpreadsheetXmlWhitespace,
	preservesXmlWhitespace,
	WHITESPACE_PRESERVING_TAGS,
} from './xml-whitespace';

export { computeDetailStatus, computeVerificationStatus } from './signature-inspection-status';

export { parseSeriesTrendlines, parseSeriesErrBars, parseLineStyle } from './chart-advanced-parser';
export { parseDataTable } from './chart-data-table-parser';

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
	reapplyAlternateContentToTree,
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

export {
	isHeaderFooterPlaceholder,
	inheritedPlaceholderFieldType,
} from './header-footer-placeholder';

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
	ensureXmlChild,
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

// Auto-numbered bullet markers (`ST_TextAutonumberScheme`). The single copy:
// the load path stamps the marker onto the parsed segment and
// `pptx-viewer-shared` re-exports these for the render layer, so the two can
// never disagree and paint a double marker.
export {
	formatAutoNumberMarker,
	romanNumeral,
	alphaLabel,
	TEXT_AUTONUMBER_SCHEMES,
} from './auto-number-format';
export {
	formatScriptAutoNumber,
	bijectiveLabel,
	toChineseNumeral,
	toHebrewNumeral,
	toArabicAbjadNumeral,
	toDevanagariDigits,
	toThaiDigits,
	toFullWidthDigits,
	HINDI_VOWELS,
	HINDI_CONSONANTS,
	THAI_CONSONANTS,
	ARABIC_HIJAI_LETTERS,
} from './auto-number-scripts';
