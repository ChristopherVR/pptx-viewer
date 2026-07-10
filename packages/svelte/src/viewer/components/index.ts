/**
 * Component prop contracts. The `.svelte` components themselves are imported
 * directly by path (Svelte convention); only the internal `PowerPointViewer`
 * root is re-exported publicly, via `../component`.
 */
export type {
	ElementRendererProps,
	NotesPanelProps,
	SlideStageProps,
	TextBlockProps,
	ThumbnailRailProps,
	ViewerToolbarProps,
} from './props';
