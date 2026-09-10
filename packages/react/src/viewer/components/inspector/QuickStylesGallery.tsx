import type { ShapeStyle } from 'pptx-viewer-core';
import { getDensePanelTouchTargetPx, quickStyleSwatchCss } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SHAPE_QUICK_STYLES } from '../../constants';
import { useIsMobile } from '../../hooks/useIsMobile';
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
	const { viewportWidth } = useIsMobile();
	// Each preset is a dense-gallery swatch (a colour/style preview, same
	// category as the theme-colour grid), but unlike those it is a genuinely
	// discrete, individually-named action button, so it still gets the WCAG
	// touch target below the mobile breakpoint from the shared decision
	// function rather than an exemption, per CLAUDE.md Rule 2.
	const swatchMinHeight = getDensePanelTouchTargetPx(viewportWidth);
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
						className='w-full rounded border border-border hover:border-primary transition-colors'
						style={{ ...quickStyleSwatchCss(qs), minHeight: swatchMinHeight }}
						onClick={() => onUpdateShapeStyle(qs.style)}
					/>
				))}
			</div>
		</div>
	);
}
