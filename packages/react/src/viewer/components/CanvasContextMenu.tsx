import {
	buildCanvasContextMenuEntries,
	contextMenuViewItems,
	customizeCanvasContextMenuEntries,
} from 'pptx-viewer-shared';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import {
	canvasContextMenuContext,
	canvasContextMenuHandlers,
} from './canvas-context-menu-dispatch';
import type { CanvasContextMenuProps } from './canvas-context-menu-types';
import { ContextMenuSurface } from './ContextMenuSurface';
import { useViewerCustomizationContext } from './viewer-customization-context';

/**
 * The right-click menu for the empty slide canvas (no element under the
 * cursor). Sibling of `ContextMenu` (the per-element menu): the command list
 * comes from `pptx-viewer-shared`'s `canvas-context-menu-commands` and the rows
 * are drawn by the shared `pptx-ui-context-menu`; this file keeps the gating
 * and the handlers.
 */
export function CanvasContextMenu(props: CanvasContextMenuProps): React.ReactElement | null {
	const { canvasContextMenuState, mode, onClose } = props;
	const { t } = useTranslation();
	const customization = useViewerCustomizationContext();
	const open = Boolean(canvasContextMenuState) && mode === 'edit';
	const handlers = canvasContextMenuHandlers(props);
	// Host customisation drops hidden commands; a menu left empty (or one the
	// host disabled outright) renders nothing at all.
	const entries = customizeCanvasContextMenuEntries(
		buildCanvasContextMenuEntries(canvasContextMenuContext(props)),
		customization,
		{ slideIndex: props.slideIndex ?? 0 },
	);
	if (!open || entries.length === 0) {
		return null;
	}
	const request = (id: string): void => {
		const entry = entries.find((candidate) => candidate.id === id);
		if (entry && 'host' in entry) {
			onClose();
			entry.onSelect();
		} else if (entry) {
			handlers[entry.id]?.();
		}
	};
	return (
		<ContextMenuSurface
			x={canvasContextMenuState?.x ?? 0}
			y={canvasContextMenuState?.y ?? 0}
			label={t('pptx.canvasContextMenu.ariaLabel')}
			markers={['data-pptx-context-menu', 'data-pptx-canvas-context-menu']}
			items={contextMenuViewItems(
				entries,
				t,
				(id) => id.startsWith('host:') || Boolean(handlers[id as keyof typeof handlers]),
			)}
			onRequest={request}
			onClose={onClose}
		/>
	);
}
