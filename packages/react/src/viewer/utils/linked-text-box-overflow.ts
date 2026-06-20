/**
 * Thin re-export shim. The framework-agnostic linked-text-box overflow helpers
 * now live in `pptx-viewer-shared`.
 */
export {
	isLinkedTextBox,
	isLinkedTextBoxHead,
	getOverflowSegments,
	buildSlideOverflowMap,
} from 'pptx-viewer-shared';
