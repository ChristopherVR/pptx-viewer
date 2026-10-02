import type { PresentationContextMenuActionId, PresentationPointerTool } from 'pptx-viewer-shared';
import {
	CONTEXT_MENU_PRESENTATION_LAYER,
	getPresentationContextMenuSections,
	presentationViewItems,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ContextMenuSurface } from './ContextMenuSurface';

export interface PresentationContextMenuState {
	x: number;
	y: number;
}

export interface PresentationContextMenuProps {
	state: PresentationContextMenuState;
	onNext: () => void;
	onPrevious: () => void;
	onEndShow: () => void;
	onClose: () => void;
	/** Open the All Slides navigator (PowerPoint's "See All Slides"). */
	onSeeAllSlides?: () => void;
	/** Switch to the presenter console. */
	onShowPresenterView?: () => void;
	/** Blank the screen black or white. */
	onBlank?: (value: 'black' | 'white') => void;
	/** Select a pointer tool (arrow = plain pointer). */
	onPointerTool?: (tool: PresentationPointerTool) => void;
	/** Erase this slide's ink annotations. */
	onEraseInk?: () => void;
}

/**
 * Slide-show right-click menu, shown while presenting when Options > Advanced >
 * "Show menu on right mouse click" is on.
 *
 * Mirrors PowerPoint's slideshow menu: navigation, See All Slides, the presenter
 * console, pointer options and the blank-screen commands. Item order, grouping
 * and labels come from the shared `getPresentationContextMenuSections`; the rows
 * are drawn by the shared `pptx-ui-context-menu`.
 */
export function PresentationContextMenu(p: PresentationContextMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const sections = getPresentationContextMenuSections({
		seeAllSlides: Boolean(p.onSeeAllSlides),
		presenterView: Boolean(p.onShowPresenterView),
		pointerTools: Boolean(p.onPointerTool),
		eraseInk: Boolean(p.onEraseInk),
		blankBlack: Boolean(p.onBlank),
		blankWhite: Boolean(p.onBlank),
	});
	const actions: Record<PresentationContextMenuActionId, (() => void) | undefined> = {
		next: p.onNext,
		previous: p.onPrevious,
		seeAllSlides: p.onSeeAllSlides,
		presenterView: p.onShowPresenterView,
		pointerArrow: () => p.onPointerTool?.('none'),
		pointerPen: () => p.onPointerTool?.('pen'),
		pointerHighlighter: () => p.onPointerTool?.('highlighter'),
		pointerLaser: () => p.onPointerTool?.('laser'),
		eraseInk: p.onEraseInk,
		blankBlack: () => p.onBlank?.('black'),
		blankWhite: () => p.onBlank?.('white'),
		endShow: p.onEndShow,
	};
	return (
		<ContextMenuSurface
			x={p.state.x}
			y={p.state.y}
			label={t('pptx.presentation.menuLabel')}
			markers={['data-pptx-presentation-menu']}
			zIndex={CONTEXT_MENU_PRESENTATION_LAYER}
			items={presentationViewItems(sections, t)}
			onRequest={(id) => {
				actions[id as PresentationContextMenuActionId]?.();
				p.onClose();
			}}
			onClose={p.onClose}
		/>
	);
}
