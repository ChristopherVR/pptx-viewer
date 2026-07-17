import { TAB_ROW_ACTION_CLASSES as TRA } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuShare2 } from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { cn } from '../../utils';
import { useCollaboration } from '../collaboration';

export interface TabRowActionsProps {
	onEnterRehearsalMode?: () => void;
	onOpenShareDialog?: () => void;
	onPackageForSharing?: () => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
}

/**
 * Right-side actions on the ribbon tab row (PowerPoint places Record and
 * Share there). Record starts rehearsal mode (records slide timings).
 */
export function TabRowActions(p: TabRowActionsProps): React.ReactElement {
	const { t } = useTranslation();
	const collab = useCollaboration();
	const isCollaborating = collab && collab.status === 'connected';
	const { isHidden } = useToolbarVisibility(p.hiddenActions);

	return (
		<div className='flex items-center gap-1 pr-1'>
			{p.onEnterRehearsalMode && !isHidden('record') && (
				<button
					type='button'
					onClick={p.onEnterRehearsalMode}
					className={TRA.record}
					title={t('pptx.titleBar.record')}
					aria-label={t('pptx.titleBar.record')}
				>
					<span className={TRA.recordDot} aria-hidden='true' />
					<span>{t('pptx.titleBar.record')}</span>
				</button>
			)}
			{!isHidden('share') && (
				<button
					type='button'
					onClick={p.onOpenShareDialog ?? p.onPackageForSharing}
					className={cn(
						'relative inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors whitespace-nowrap',
						isCollaborating
							? 'bg-green-600 hover:bg-green-500 text-white'
							: 'bg-primary hover:bg-primary/90 text-white',
					)}
					title={
						isCollaborating
							? t('pptx.toolbar.sharingUsers', { count: collab.connectedCount })
							: t('pptx.toolbar.share')
					}
					aria-label={t('pptx.toolbar.share')}
				>
					<LuShare2 className='w-3 h-3' />
					<span>
						{isCollaborating
							? t('pptx.toolbar.sharingCount', { count: collab.connectedCount })
							: t('pptx.toolbar.share')}
					</span>
				</button>
			)}
		</div>
	);
}
