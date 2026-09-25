/**
 * Prop contracts for the internal viewer components. Kept in plain `.ts`
 * modules (not inside the SFCs) per repo convention: SFCs stay thin
 * presentation, logic and types live in lintable TypeScript files.
 *
 * This file is the barrel every component imports from; the contracts
 * themselves are grouped by surface across the `props-*.ts` siblings so no
 * single file exceeds the repo's size budget.
 */

export type {
	ElementRendererProps,
	SmartArtDrawingViewProps,
	TextBlockProps,
} from './props-elements';
export type { SlideCanvasProps, SlideStageProps } from './props-stage';
export type { NotesPanelProps, ThumbnailRailProps, ViewerToolbarProps } from './props-chrome';
export type {
	CanvasContextMenuProps,
	EditorLayerProps,
	ElementContextMenuProps,
	InlineTextEditorProps,
	SelectionOverlayProps,
	StageCanvasContextMenu,
	StageContextMenu,
} from './props-editing';
