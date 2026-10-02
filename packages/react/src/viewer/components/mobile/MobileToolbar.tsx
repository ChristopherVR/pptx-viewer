import type {
	MobileToolbarId,
	MobileToolbarIntent,
	PptxUiMobileToolbarElement,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { useWebControl } from '../../hooks/useWebControl';
import type { ToolbarProps } from '../toolbar/toolbar-types';
import { MobileMenuSheet } from './MobileMenuSheet';

/**
 * Mobile-first replacement for the desktop ribbon toolbar.
 *
 * A thin adapter around the shared `pptx-ui-mobile-toolbar`, which renders a
 * single compact row of essential controls:
 *   menu · undo · redo · [AI] · save · present · share
 *
 * All section-specific functionality (Home/Insert/Design/etc.) lives in the
 * MobileMenuSheet that opens from the hamburger menu, and the contextual
 * action bar at the bottom of the screen handles common per-selection tasks.
 */
export function MobileToolbar(props: ToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const { mode, canUndo, canRedo, onUndo, onRedo, onSetMode, onSaveAsPptx } = props;
	const [menuOpen, setMenuOpen] = useState(false);
	const { isHidden } = useToolbarVisibility(props.hiddenActions);

	const showEdit = mode === 'edit' || mode === 'master';
	const hidden: MobileToolbarId[] = [];
	if (isHidden('undo')) {
		hidden.push('undo');
	}
	if (isHidden('redo')) {
		hidden.push('redo');
	}
	if (isHidden('fullscreen')) {
		hidden.push('present');
	}
	if (isHidden('share')) {
		hidden.push('share');
	}

	const handlers: Record<MobileToolbarId, () => void> = {
		menu: () => setMenuOpen(true),
		undo: onUndo,
		redo: onRedo,
		ai: () => props.onToggleAiPanel?.(),
		save: onSaveAsPptx,
		present: () => onSetMode('present'),
		share: () => props.onOpenShareDialog?.(),
	};
	const ref = useWebControl<PptxUiMobileToolbarElement>(
		{
			editable: showEdit,
			canUndo,
			canRedo,
			aiVisible: props.aiEnabled === true,
			aiActive: props.isAiPanelOpen === true,
			menuOpen,
			hidden,
			translate: t,
		},
		{
			'mobile-toolbar-request': (event) => handlers[(event.detail as MobileToolbarIntent).id](),
		},
	);

	return (
		<div className='relative z-20'>
			<pptx-ui-mobile-toolbar ref={ref} />
			{/* Section sheet */}
			<MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} {...props} />
		</div>
	);
}
