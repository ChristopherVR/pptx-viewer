import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SlidesPaneSidebarProps } from '../slides-pane/types';
import { SlidesPaneSidebar } from '../SlidesPaneSidebar';
import { MobileSheet } from './MobileSheet';

export interface MobileSlidesSheetProps extends Omit<SlidesPaneSidebarProps, 'panelWidth'> {
	open: boolean;
	onClose: () => void;
}

/**
 * Bottom-sheet host for the slides panel on mobile. Reuses the existing
 * SlidesPaneSidebar (with its virtualization + sections + DnD) but renders it
 * inside a full-width drag-up sheet sized to ~70dvh so the active canvas
 * remains partially visible.
 */
export function MobileSlidesSheet({
	open,
	onClose,
	...sidebar
}: MobileSlidesSheetProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<MobileSheet
			open={open}
			onClose={onClose}
			heightFraction={0.7}
			title={t('pptx.sections.slides')}
		>
			<div className='h-full'>
				<SlidesPaneSidebar {...sidebar} />
			</div>
		</MobileSheet>
	);
}
