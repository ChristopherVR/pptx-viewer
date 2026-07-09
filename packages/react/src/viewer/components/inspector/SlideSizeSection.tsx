import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlideSizeSectionProps {
	canvasSize: CanvasSize;
	onCanvasSizeChange: (size: CanvasSize) => void;
	markDirty: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideSizeSection({
	canvasSize,
	onCanvasSizeChange,
	markDirty,
}: SlideSizeSectionProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<div className='mb-3 rounded border border-border bg-card p-2 space-y-2'>
			<div className='text-[11px] uppercase tracking-wide text-muted-foreground'>
				{t('pptx.slideSize.title', 'Slide Size')}
			</div>
			<div className='grid grid-cols-2 gap-2'>
				<label className='flex flex-col gap-1'>
					<span className='text-[10px] text-muted-foreground'>
						{t('pptx.slideSize.width', 'Width')}
					</span>
					<input
						type='number'
						min={100}
						max={3840}
						value={canvasSize.width}
						onChange={(event) => {
							const value = Number(event.target.value);
							if (!Number.isFinite(value) || value < 100) {
								return;
							}
							onCanvasSizeChange({
								...canvasSize,
								width: Math.round(value),
							});
							markDirty();
						}}
						className='bg-muted border border-border rounded px-2 py-1 text-xs'
					/>
				</label>
				<label className='flex flex-col gap-1'>
					<span className='text-[10px] text-muted-foreground'>
						{t('pptx.slideSize.height', 'Height')}
					</span>
					<input
						type='number'
						min={100}
						max={2160}
						value={canvasSize.height}
						onChange={(event) => {
							const value = Number(event.target.value);
							if (!Number.isFinite(value) || value < 100) {
								return;
							}
							onCanvasSizeChange({
								...canvasSize,
								height: Math.round(value),
							});
							markDirty();
						}}
						className='bg-muted border border-border rounded px-2 py-1 text-xs'
					/>
				</label>
			</div>
			<select
				value=''
				onChange={(event) => {
					const preset = event.target.value;
					if (!preset) {
						return;
					}
					const [widthStr, heightStr] = preset.split('x');
					const width = Number(widthStr);
					const height = Number(heightStr);
					if (!Number.isFinite(width) || !Number.isFinite(height)) {
						return;
					}
					onCanvasSizeChange({ width, height });
					markDirty();
				}}
				className='w-full bg-muted border border-border rounded px-2 py-1 text-xs text-foreground'
			>
				<option value=''>{t('pptx.slideSize.presets', 'Preset sizes...')}</option>
				<option value='1280x720'>{t('pptx.slideSize.presetWidescreen')}</option>
				<option value='960x720'>{t('pptx.slideSize.presetStandard')}</option>
				<option value='1280x1024'>{t('pptx.slideSize.presetPortrait')}</option>
				<option value='1920x1080'>{t('pptx.slideSize.presetFullHd')}</option>
				<option value='2560x1440'>{t('pptx.slideSize.presetQhd')}</option>
			</select>
		</div>
	);
}
