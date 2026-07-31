/**
 * ImageCropSection: the four crop sliders (plus a reset) for a picture, shown
 * inside the live image-properties card.
 *
 * WHY it is here at all: cropping had no other entry point in React. The
 * component existed but was only reachable from the unreferenced
 * `ElementProperties`, so the viewer parsed and re-serialised `a:srcRect`
 * faithfully while offering no way to change it. Alt text and "replace image"
 * are deliberately NOT repeated here; `ImagePropertiesPanel` already owns the
 * former and there is no image-picker handler on the live path for the latter.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { clampCropValue } from '../../utils';
import { BTN_CLS } from './element-properties-constants';

/** OOXML stores each crop as a fraction of the source edge; the UI shows %. */
const CROP_SIDES = ['Left', 'Top', 'Right', 'Bottom'] as const;

/** PowerPoint's own sliders stop well before the image collapses to nothing. */
const MAX_CROP_PERCENT = 80;

interface ImageCropSectionProps {
	selectedElement: PptxElement;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

export function ImageCropSection({
	selectedElement,
	canEdit,
	onUpdateElement,
}: ImageCropSectionProps): React.ReactElement | null {
	const { t } = useTranslation();
	if (!isImageLikeElement(selectedElement)) {
		return null;
	}

	return (
		<div className='space-y-1.5' data-pptx-image-crop>
			{CROP_SIDES.map((side) => {
				const key = `crop${side}` as keyof PptxElement;
				return (
					<label key={side} className='flex flex-col gap-1 text-[11px]'>
						<span className='text-muted-foreground'>Crop {side}</span>
						<input
							type='range'
							min={0}
							max={MAX_CROP_PERCENT}
							disabled={!canEdit}
							className='accent-primary'
							value={Math.round(clampCropValue(selectedElement[key] as number | undefined) * 100)}
							onChange={(e) =>
								onUpdateElement({
									[key]: Number(e.target.value) / 100,
								} as Partial<PptxElement>)
							}
						/>
					</label>
				);
			})}
			<button
				type='button'
				disabled={!canEdit}
				className={`${BTN_CLS} w-full`}
				onClick={() =>
					onUpdateElement({
						cropLeft: 0,
						cropTop: 0,
						cropRight: 0,
						cropBottom: 0,
					} as Partial<PptxElement>)
				}
			>
				{t('pptx.image.resetCrop')}
			</button>
		</div>
	);
}
