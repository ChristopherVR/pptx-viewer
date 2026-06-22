/**
 * Accessibility utilities. The implementations are framework-agnostic and live
 * in `pptx-viewer-shared`; this module re-exports them so existing React
 * imports (`viewer/utils/accessibility`) keep working.
 *
 * @module utils/accessibility
 */
export {
	computeReadingOrder,
	getAriaRole,
	getAriaLabel,
	getAriaRoleDescription,
	prefersReducedMotion,
	getReducedMotionStyles,
} from 'pptx-viewer-shared';
