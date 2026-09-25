import type { EditPointsCommandId, EditPointsMenuView } from 'pptx-viewer-shared';
import { Fragment } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import { ContextMenuItem, ContextMenuSeparator } from '../context-menu-parts';

export interface EditPointsMenuProps {
	menu: EditPointsMenuView;
	onRun: (id: EditPointsCommandId) => void;
}

/**
 * The Edit Points right-click menu (a vertex or a segment). Entries, order,
 * greying and checks come from the shared session; this is the React paint.
 *
 * Rendered inside the scaled stage at the click's slide position and scaled
 * back by `inverseScale`, so it stays screen-sized at every zoom without a
 * portal (a `position: fixed` child of the transformed stage would be placed
 * relative to the stage, not the viewport).
 */
export function EditPointsMenu({ menu, onRun }: EditPointsMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	return (
		<div
			role='menu'
			tabIndex={-1}
			aria-label={t('pptx.editPoints.menu')}
			data-pptx-edit-points-menu='true'
			className='absolute z-[61] min-w-[180px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground'
			style={{
				left: menu.x,
				top: menu.y,
				transform: `scale(${menu.inverseScale})`,
				transformOrigin: '0 0',
			}}
			onPointerDown={stop}
			onMouseDown={stop}
			onClick={stop}
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			{menu.entries.map((entry) => (
				<Fragment key={entry.id}>
					{entry.separatorBefore && <ContextMenuSeparator />}
					<div role='none' data-pptx-edit-points-command={entry.id}>
						<ContextMenuItem
							disabled={entry.disabled}
							checked={entry.checked}
							onSelect={() => onRun(entry.id)}
						>
							{t(entry.labelKey)}
						</ContextMenuItem>
					</div>
				</Fragment>
			))}
		</div>
	);
}
