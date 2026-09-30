import type { CanvasContextMenuState } from '../types';
import type { CanvasContextMenuDispatchProps } from './canvas-context-menu-dispatch';

export interface CanvasContextMenuProps extends CanvasContextMenuDispatchProps {
	slideIndex?: number;
	canvasContextMenuState: CanvasContextMenuState;
	mode: string;
}
