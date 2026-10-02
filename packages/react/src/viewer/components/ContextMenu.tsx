import {
	buildContextMenuEntries,
	contextMenuViewItems,
	customizeContextMenuEntries,
} from 'pptx-viewer-shared';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import { contextMenuContext, contextMenuHandlers } from './context-menu-dispatch';
import type { ContextMenuProps } from './context-menu-types';
import { ContextMenuSurface } from './ContextMenuSurface';
import { useShapeFormatContext } from './shape-format-context';
import { useViewerCustomizationContext } from './viewer-customization-context';

/**
 * The canvas right-click menu.
 *
 * The command list, its order and its separators come from
 * `pptx-viewer-shared`, not from this file: the five bindings each hand-wrote
 * their own menu and quietly ended up offering different things. The rows are
 * drawn by the shared `pptx-ui-context-menu`; this adapter keeps the entries,
 * the gating and the editor handlers.
 */
export function ContextMenu(props: ContextMenuProps): React.ReactElement | null {
	const { contextMenuState, mode, onClose } = props;
	const { t } = useTranslation();
	const customization = useViewerCustomizationContext();
	const shapeFormat = useShapeFormatContext();
	const open = Boolean(contextMenuState) && mode === 'edit';
	const handlers = contextMenuHandlers(props, shapeFormat);
	// Host customisation drops hidden commands; a menu left empty (or one the
	// host disabled outright) renders nothing at all.
	const entries = customizeContextMenuEntries(
		buildContextMenuEntries(contextMenuContext(props, shapeFormat)),
		customization,
		{
			slideIndex: props.slideIndex ?? 0,
			elementIds: props.elementIds ?? (props.selectedElement ? [props.selectedElement.id] : []),
		},
	);
	const request = (id: string): void => {
		const entry = entries.find((candidate) => candidate.id === id);
		if (entry && 'host' in entry) {
			onClose();
			entry.onSelect();
		} else if (entry) {
			handlers[entry.id]?.();
		}
	};
	if (!open || entries.length === 0) {
		return null;
	}
	return (
		<ContextMenuSurface
			x={contextMenuState?.x ?? 0}
			y={contextMenuState?.y ?? 0}
			label={t('pptx.contextMenu.ariaLabel')}
			markers={['data-pptx-context-menu']}
			// A command the host wired no handler for is offered and greyed, never
			// dropped: a menu that changes shape per viewer is the drift the shared
			// list exists to prevent.
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
