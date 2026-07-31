import type { ShapeStyle } from 'pptx-viewer-core';
import { quickStyleSwatchCss } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SHAPE_QUICK_STYLES } from '../../constants';
import { LBL } from './FillStrokeHelpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuickStylesGalleryProps {
	onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickStylesGallery({
	onUpdateShapeStyle,
}: QuickStylesGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='flex flex-col gap-1'>
			<span className={LBL}>{t('pptx.shape.quickStyles')}</span>
			<div className='grid grid-cols-6 gap-1'>
				{SHAPE_QUICK_STYLES.map((qs, idx) => (
					<button
						key={idx}
						type='button'
						title={qs.name}
						aria-label={qs.name}
						className='h-7 w-full rounded border border-border hover:border-primary transition-colors'
						style={quickStyleSwatchCss(qs)}
						onClick={() => onUpdateShapeStyle(qs.style)}
					/>
				))}
			</div>
		</div>
	);
}
