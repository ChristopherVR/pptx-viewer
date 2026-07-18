export { useLoadContent } from './useLoadContent';
export type { UseLoadContentResult } from './useLoadContent';
export {
	collectMediaElements,
	collectImagePaths,
	buildInitialGuides,
} from './load-content-helpers';
export type { GuideEntry, ImagePathElement } from './load-content-helpers';
export {
	getContainerStyle,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
	getImageSrc,
} from './element-style';
export { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from 'pptx-viewer-shared';
export { useEditorHistory } from './useEditorHistory';
export { useEditorOperations } from './useEditorOperations';
export { useCollaboration } from './useCollaboration';
export type {
	RemotePresence,
	UseCollaborationOptions,
	UseCollaborationResult,
} from './useCollaboration';
// Granular collaboration composables (cross-binding parity with React/Angular).
// `useCollaboration` stays as the convenience wrapper that bundles every facet.
export {
	useYjsProvider,
	usePresenceTracking,
	useCollaborativeState,
	useCollaborativeHistory,
} from './useCollaborationGranular';
export type {
	UsePresenceTrackingResult,
	UseCollaborativeStateResult,
	UseCollaborativeHistoryInput,
	UseCollaborativeHistoryResult,
} from './useCollaborationGranular';
export {
	AUDIENCE_HASH,
	isAudienceTab,
	parseAudienceNonce,
	storeAudienceContent,
	loadAudienceContent,
	clearAudienceContent,
} from './audience-content-store';
