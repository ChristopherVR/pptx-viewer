import type { CanvasContextMenuState } from '../types';
import type { CanvasContextMenuDispatchProps } from './canvas-context-menu-dispatch';

export interface CanvasContextMenuProps extends CanvasContextMenuDispatchProps {
	canvasContextMenuState: CanvasContextMenuState;
	mode: string;
}
