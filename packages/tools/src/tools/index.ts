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
