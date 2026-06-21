import {
	DEFAULT_CANVAS_WIDTH as _W,
	DEFAULT_CANVAS_HEIGHT as _H,
	DEFAULT_TEXT_COLOR as _TC,
	DEFAULT_FILL_COLOR as _FC,
	DEFAULT_STROKE_COLOR as _SC,
} from 'pptx-viewer-shared';

// Re-assigned as local constants to avoid a Rolldown chunk-membership panic
// that occurs when symbols are re-exported directly from a bundled workspace
// package through a local barrel file.
export const DEFAULT_CANVAS_WIDTH = _W;
export const DEFAULT_CANVAS_HEIGHT = _H;
export const DEFAULT_TEXT_COLOR = _TC;
export const DEFAULT_FILL_COLOR = _FC;
export const DEFAULT_STROKE_COLOR = _SC;
