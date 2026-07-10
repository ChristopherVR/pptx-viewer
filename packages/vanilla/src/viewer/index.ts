export { createPptxViewer, PptxViewer } from './PptxViewer';
export type { PptxViewerCallbacks, PptxViewerInstance, PptxViewerOptions } from './types';
export type {
	AutosaveRecord,
	AutosaveStatus,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
} from './types';
export type { AutosaveController } from './autosave';
export { createAutosaveController } from './autosave';
export type { CollaborationController } from './collab';
export { createCollaborationController } from './collab';
export type { RenderController, RenderControllerDeps } from './render-controller';
export { createRenderController } from './render-controller';
export type { StateSyncDeps } from './state-sync';
export { createStateSync } from './state-sync';
export { applyThemeVars } from './theme-apply';
export * from './export';
export * from './i18n';
export * from './load';
export * from './render';
export * from './state';
export * from './styles';
export * from './ui';
