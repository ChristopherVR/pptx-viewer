export {
	getSlide,
	addSlide,
	deleteSlides,
	reorderSlides,
	duplicateSlide,
	updateSlideProperties,
	setSlideTransition,
	setCanvasSize,
} from './slide-tools.js';
export type {
	GetSlideResult,
	AddSlideParams,
	AddSlideResult,
	DeleteSlidesParams,
	DeleteSlidesResult,
	ReorderSlidesParams,
	DuplicateSlideParams,
	UpdateSlidePropertiesParams,
	SetSlideTransitionParams,
	SetCanvasSizeParams,
} from './slide-tools.js';

export {
	generateElementId,
	generateSlideId,
	describeElement,
	extractSlideText,
	validateSlideIndex,
} from './helpers.js';

export {
	addElement,
	updateElement,
	renameElement,
	deleteElements,
	arrangeElements,
	cloneElement,
	setElementAnimation,
	groupElements,
	ungroupElements,
	batchUpdateElements,
} from './element-tools.js';
export type {
	AddElementParams,
	AddElementResult,
	UpdateElementParams,
	RenameElementParams,
	DeleteElementsParams,
	ArrangeElementsParams,
	CloneElementParams,
	CloneElementResult,
	SetElementAnimationParams,
	GroupElementsParams,
	GroupElementsResult,
	UngroupElementsParams,
	UngroupElementsResult,
	BatchUpdateElementsParams,
} from './element-tools.js';

export { updateTableCells, manageTableStructure } from './table-tools.js';
export type { UpdateTableCellsParams, ManageTableStructureParams } from './table-tools.js';

export { updateElementStyle, runAccessibilityCheck } from './style-tools.js';
export type {
	UpdateElementStyleParams,
	AccessibilityIssue,
	AccessibilityCheckResult,
} from './style-tools.js';

export { findText, replaceText, manageComments } from './content-tools.js';
export type {
	FindTextParams,
	TextMatch,
	FindTextResult,
	ReplaceTextParams,
	ReplaceTextResult,
	ManageCommentsParams,
	CommentInfo,
	ManageCommentsResult,
} from './content-tools.js';

export { convertToMarkdown } from './conversion-tools.js';
export type { ConvertToMarkdownParams, ConvertToMarkdownResult } from './conversion-tools.js';

export {
	getThemeInfo,
	applyThemePreset,
	updateThemeColors,
	updateThemeFonts,
} from './theme-tools.js';
export type {
	ThemeInfo,
	ApplyThemePresetParams,
	ApplyThemePresetResult,
	UpdateThemeColorsParams,
	UpdateThemeFontsParams,
} from './theme-tools.js';

export {
	updateChart,
	addChartSeriesT,
	removeChartSeriesT,
	updateChartSeriesData,
	createChart,
} from './chart-tools.js';
export type {
	UpdateChartParams,
	AddChartSeriesParams,
	RemoveChartSeriesParams,
	UpdateChartSeriesDataParams,
	CreateChartParams,
	CreateChartResult,
} from './chart-tools.js';

export { manageSmartArt } from './smartart-tools.js';
export type {
	ManageSmartArtParams,
	SmartArtNodeInfo,
	ManageSmartArtResult,
} from './smartart-tools.js';

export { mergePresentationT, diffPresentationsT } from './merge-tools.js';
export type {
	MergePresentationParams,
	MergePresentationResult,
	DiffPresentationsParams,
} from './merge-tools.js';

export { findPlaceholdersT, applyTemplateT } from './template-tools.js';
export type {
	FindPlaceholdersResult,
	ApplyTemplateParams,
	ApplyTemplateResult,
} from './template-tools.js';

export { getMetadata, updateMetadata } from './metadata-tools.js';
export type { MetadataResult, UpdateMetadataParams } from './metadata-tools.js';

export { manageSections } from './section-tools.js';
export type { ManageSectionsParams, SectionInfo, ManageSectionsResult } from './section-tools.js';

export { exportToSvg, exportSlideSvg } from './export-tools.js';
export type {
	ExportToSvgParams,
	ExportToSvgResult,
	ExportSlideSvgParams,
	ExportSlideSvgResult,
} from './export-tools.js';

export { exportToJson, importFromJson } from './json-tools.js';
export type {
	ExportToJsonParams,
	ExportToJsonResult,
	ImportFromJsonParams,
	ImportFromJsonResult,
} from './json-tools.js';

export { manageHyperlinks } from './hyperlink-tools.js';
export type {
	ManageHyperlinksParams,
	HyperlinkInfo,
	ManageHyperlinksResult,
} from './hyperlink-tools.js';

export { replaceGeometry } from './geometry-tools.js';
export type { ReplaceGeometryParams } from './geometry-tools.js';

export { setElementLockT } from './lock-tools.js';
export type { SetElementLockParams } from './lock-tools.js';

export { validatePresentation, repairPresentation } from './validation-tools.js';
export type { ValidatePresentationResult, RepairPresentationResult } from './validation-tools.js';

export { getPresentationProperties, updatePresentationProperties } from './presentation-tools.js';
export type { UpdatePresentationPropertiesParams } from './presentation-tools.js';

export { getLayouts, applyLayout } from './layout-tools.js';
export type {
	GetLayoutsResult,
	ApplyLayoutParams,
	ApplyLayoutResult,
	LayoutInfo,
} from './layout-tools.js';
