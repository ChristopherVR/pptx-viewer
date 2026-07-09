import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuImage } from 'react-icons/lu';

import { clampCropValue } from '../../utils';
import { BTN_CLS } from './element-properties-constants';

const CROP_SIDES = ['Left', 'Top', 'Right', 'Bottom'] as const;

interface ImageCropSectionProps {
	selectedElement: PptxElement;
	updateElement: (updater: (el: PptxElement) => PptxElement) => void;
	onOpenImagePicker: () => void;
}

export function ImageCropSection({
	selectedElement,
	updateElement,
	onOpenImagePicker,
}: ImageCropSectionProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='space-y-2'>
			<button type='button' className={BTN_CLS} onClick={onOpenImagePicker}>
				<LuImage className='w-3.5 h-3.5' /> Replace Image
			</button>
			<div className='grid grid-cols-2 gap-2'>
				{CROP_SIDES.map((side) => {
					const k = `crop${side}` as keyof PptxElement;
					return (
						<label key={side} className='flex flex-col gap-1 col-span-2'>
							<span className='text-muted-foreground'>Crop {side}</span>
							<input
								type='range'
								min={0}
								max={80}
								className='accent-primary'
								value={Math.round(clampCropValue(selectedElement[k] as number | undefined) * 100)}
								onChange={(e) =>
									updateElement((el) =>
										!isImageLikeElement(el)
											? el
											: {
													...el,
													[k]: Number(e.target.value) / 100,
												},
									)
								}
							/>
						</label>
					);
				})}
				<button
					type='button'
					className={`${BTN_CLS} col-span-2`}
					onClick={() =>
						updateElement((el) =>
							!isImageLikeElement(el)
								? el
								: {
										...el,
										cropLeft: 0,
										cropTop: 0,
										cropRight: 0,
										cropBottom: 0,
									},
						)
					}
				>
					{t('pptx.image.resetCrop')}
				</button>
			</div>
			<label className='flex flex-col gap-1'>
				<span className='text-muted-foreground'>{t('pptx.image.altText')}</span>
				<textarea
					rows={2}
					placeholder={t('pptx.imageTransform.altTextPlaceholder')}
					value={((selectedElement as unknown as Record<string, unknown>).altText as string) || ''}
					onChange={(e) =>
						updateElement((el) =>
							!isImageLikeElement(el) ? el : { ...el, altText: e.target.value },
						)
					}
					className='bg-muted border border-border rounded px-2 py-1 resize-y text-xs'
				/>
			</label>
		</div>
	);
}
