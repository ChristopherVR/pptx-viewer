import type { PptxElement } from 'pptx-viewer-core';
import { getNonVisualDescriptionFields } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { CARD, HEADING, INPUT } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccessibilityTextSectionProps {
	selectedElement: PptxElement;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Alt text / title editor for a plain shape, text box or connector.
 *
 * A picture's own alt text field lives in `ImagePropertiesPanel`; this
 * covers the three element kinds that only started modelling `altText` /
 * `title` once core parsed `p:cNvPr/@descr` / `@title` on `p:sp` / `p:cxnSp`
 * (see `PptxNonVisualDescription`). `getNonVisualDescriptionFields` (shared)
 * decides which fields apply so this component stays a thin view.
 */
export function AccessibilityTextSection({
	selectedElement,
	canEdit,
	onUpdateElement,
}: AccessibilityTextSectionProps): React.ReactElement | null {
	const { t } = useTranslation();
	const fields = getNonVisualDescriptionFields(selectedElement);

	if (!fields.showAltText && !fields.showTitle) {
		return null;
	}

	return (
		<div className={CARD} data-pptx-accessibility-text>
			<div className={HEADING}>{t('pptx.accessibility.heading', 'Accessibility')}</div>
			{fields.showAltText && (
				<label className='flex flex-col gap-1 text-[11px]'>
					<span className='text-muted-foreground'>{t('pptx.elementAccessibility.altText')}</span>
					<textarea
						rows={2}
						disabled={!canEdit}
						placeholder={t('pptx.elementAccessibility.altTextPlaceholder')}
						className={cn(INPUT, 'resize-none text-[11px]')}
						value={fields.altText}
						onChange={(e) => onUpdateElement({ altText: e.target.value } as Partial<PptxElement>)}
					/>
				</label>
			)}
			{fields.showTitle && (
				<label className='flex flex-col gap-1 text-[11px]'>
					<span className='text-muted-foreground'>{t('pptx.elementAccessibility.title')}</span>
					<input
						type='text'
						disabled={!canEdit}
						placeholder={t('pptx.elementAccessibility.titlePlaceholder')}
						className={cn(INPUT, 'text-[11px]')}
						value={fields.title}
						onChange={(e) => onUpdateElement({ title: e.target.value } as Partial<PptxElement>)}
					/>
				</label>
			)}
		</div>
	);
}
