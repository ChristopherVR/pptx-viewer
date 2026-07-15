import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { cn } from '../../utils';
import { INSPECTOR_TABS } from './inspector-pane-constants';
import type { InspectorTab } from './inspector-pane-types';

interface InspectorPaneHeaderProps {
	activeTab: InspectorTab;
	onSetActiveTab: (tab: InspectorTab) => void;
	onClose: () => void;
}

export function InspectorPaneHeader({
	activeTab,
	onSetActiveTab,
	onClose,
}: InspectorPaneHeaderProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='flex items-center justify-between gap-2 px-3 py-2 border-b border-border'>
			<div className='flex items-center gap-1 rounded bg-muted p-0.5'>
				{INSPECTOR_TABS.map(({ key, label, icon: Icon }) => (
					<button
						key={key}
						type='button'
						title={label}
						className={cn(
							'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
							activeTab === key
								? 'bg-primary text-white'
								: 'text-muted-foreground hover:text-foreground hover:bg-accent',
						)}
						onClick={() => onSetActiveTab(key)}
					>
						<Icon className='w-3.5 h-3.5' />
						<span className='hidden sm:inline'>{label}</span>
					</button>
				))}
			</div>
			<button
				type='button'
				onClick={onClose}
				title={t('common.close')}
				className='p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
			>
				<LuX className='w-4 h-4' />
			</button>
		</div>
	);
}
