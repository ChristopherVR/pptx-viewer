export { createPptxViewer, PptxViewer } from './PptxViewer';
// Type-only: `RibbonHandlers.edit`/`findReplace` are typed by these (see
// `./ui/ribbon/ribbon-types.ts`). Only the two composed action-set types are
// surfaced here, not the rest of `./editor`'s internal wiring (controllers,
// factories, gesture/mutation helpers), which stays coupled to `PptxViewer`.
export type { EditActions } from './editor';
export type { FindReplaceActions } from './editor';
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
export type { ExportLifecycle, ExportLifecycleDeps, ViewerExportApi } from './export-lifecycle';
export { createExportLifecycle, ViewerExportHost } from './export-lifecycle';
export * from './export';
export * from './i18n';
export * from './load';
export * from './render';
export * from './state';
export * from './styles';
export * from './ui';
