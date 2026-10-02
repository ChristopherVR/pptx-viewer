import { editingHomeControls } from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { groupAttr } from './PowerPointRibbonControls';
import { sep } from './toolbar-constants';
import { WebHomeControls } from './WebHomeControls';

export interface EditingSectionProps {
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
}

/** Home > Editing: the shared Find, Replace and Select strip. */
export function EditingSection(p: EditingSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { onToggleFindReplace, onSelectAll } = p;
	const controls = useMemo(
		() => editingHomeControls({ selectAll: Boolean(onSelectAll) }),
		[onSelectAll],
	);
	const request = useCallback(
		(id: string) => (id === 'home.editing.select' ? onSelectAll?.() : onToggleFindReplace()),
		[onSelectAll, onToggleFindReplace],
	);
	return (
		<>
			{sep}

			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.editing')}>
				<div className='flex items-center gap-1'>
					<WebHomeControls family='editing' controls={controls} onRequest={request} />
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.editing')}
				</span>
			</div>
		</>
	);
}
