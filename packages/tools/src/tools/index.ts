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
