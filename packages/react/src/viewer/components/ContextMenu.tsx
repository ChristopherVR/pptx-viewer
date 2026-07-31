import { buildContextMenuEntries } from 'pptx-viewer-shared';
import type React from 'react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { contextMenuContext, contextMenuHandlers } from './context-menu-dispatch';
import { ContextMenuItem, ContextMenuSeparator } from './context-menu-parts';
import type { ContextMenuProps } from './context-menu-types';

/**
 * The canvas right-click menu.
 *
 * The command list, its order and its separators come from
 * `pptx-viewer-shared`, not from this file: the five bindings each hand-wrote
 * their own menu and quietly ended up offering different things (no Bring to
 * Front here, no Edit Hyperlink there, no table commands at all somewhere
 * else). Rendering React's reference menu from the same list the other four use
 * is what keeps them honest.
 */
export function ContextMenu(props: ContextMenuProps): React.ReactElement | null {
	const { contextMenuState, mode, onClose } = props;
	const { t } = useTranslation();

	if (!contextMenuState || mode !== 'edit') {
		return null;
	}

	const handlers = contextMenuHandlers(props);
	const entries = buildContextMenuEntries(contextMenuContext(props));

	return (
		<>
			{/* Invisible backdrop to close menu on outside click */}
			<div
				className='fixed inset-0 z-[119]'
				onClick={onClose}
				onContextMenu={(e) => {
					e.preventDefault();
					onClose();
				}}
			/>
			<div
				data-pptx-context-menu='true'
				role='menu'
				aria-label={t('pptx.contextMenu.ariaLabel')}
				className='fixed z-[120] min-w-[180px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground'
				style={{
					left: Math.max(contextMenuState.x, 8),
					top: Math.max(contextMenuState.y, 8),
				}}
			>
				{entries.map((entry) => {
					const run = handlers[entry.id];
					return (
						<Fragment key={entry.id}>
							{entry.separatorBefore && <ContextMenuSeparator />}
							<ContextMenuItem
								danger={entry.danger}
								// A command the host wired no handler for is offered and greyed,
								// never dropped: a menu that changes shape per viewer is exactly
								// the drift this shared list exists to prevent.
								disabled={entry.disabled || !run}
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
