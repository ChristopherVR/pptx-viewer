import { buildCanvasContextMenuEntries } from 'pptx-viewer-shared';
import type React from 'react';
import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
	canvasContextMenuContext,
	canvasContextMenuHandlers,
} from './canvas-context-menu-dispatch';
import type { CanvasContextMenuProps } from './canvas-context-menu-types';
import { ContextMenuItem, ContextMenuSeparator } from './context-menu-parts';

/**
 * The right-click menu for the empty slide canvas (no element under the
 * cursor). Sibling of `ContextMenu` (the per-element menu): the command list
 * comes from `pptx-viewer-shared`'s `canvas-context-menu-commands`, this file
 * is only the rendering.
 */
export function CanvasContextMenu(props: CanvasContextMenuProps): React.ReactElement | null {
	const { canvasContextMenuState, mode, onClose } = props;
	const { t } = useTranslation();
	const open = Boolean(canvasContextMenuState) && mode === 'edit';

	useEffect(() => {
		if (!open) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	const handlers = canvasContextMenuHandlers(props);
	const entries = buildCanvasContextMenuEntries(canvasContextMenuContext(props));

	return (
		<>
			<div
				className='fixed inset-0 z-[119]'
				onClick={onClose}
				onContextMenu={(e) => {
					e.preventDefault();
					onClose();
				}}
			/>
			<div
				data-pptx-canvas-context-menu='true'
				role='menu'
				aria-label={t('pptx.canvasContextMenu.ariaLabel')}
				className='fixed z-[120] min-w-[180px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground'
				style={{
					left: Math.max(canvasContextMenuState.x, 8),
					top: Math.max(canvasContextMenuState.y, 8),
				}}
			>
				{entries.map((entry) => {
					const run = handlers[entry.id];
					return (
						<Fragment key={entry.id}>
							{entry.separatorBefore && <ContextMenuSeparator />}
							<ContextMenuItem
								disabled={entry.disabled || !run}
								checked={entry.checked}
								onSelect={() => run?.()}
							>
								{t(entry.labelKey)}
							</ContextMenuItem>
						</Fragment>
					);
				})}
			</div>
		</>
	);
}
