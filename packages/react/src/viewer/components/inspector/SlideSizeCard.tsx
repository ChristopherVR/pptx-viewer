/**
 * SlideSizeCard: the Design > Slide Size control, inspector edition.
 *
 * Every decision here (which preset a size matches, what a preset produces in
 * a given orientation, and whether the EMU size or the typed pixels win) comes
 * from `pptx-viewer-shared`'s `slide-size` module, so the other four bindings
 * can render the same descriptor without re-deriving any of it.
 */
import {
	resolveSlideSizeSelection,
	slideSizeFromPreset,
	SLIDE_SIZE_PRESETS,
	withSlideSizeOrientation,
} from 'pptx-viewer-shared';
import type { SlideSizeEmu, SlideSizeOrientation } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';
import { CARD, HEADING, INPUT } from './inspector-pane-constants';

/** Sentinel `<option>` value for a size that matches no preset. */
const CUSTOM_PRESET_VALUE = '';

export interface SlideSizeCardProps {
	canvasSize: CanvasSize;
	/**
	 * The EMU `p:sldSz` the viewer holds. Absent until a deck loads, in which
	 * case the pixel canvas alone decides the selection.
	 */
	slideSizeEmu?: SlideSizeEmu | undefined;
	canEdit: boolean;
	/** Raw W/H pixel edit. */
	onUpdate: (size: CanvasSize) => void;
	/**
	 * A preset or orientation pick, in EMU. Distinct from {@link onUpdate}
	 * because a pixel round-trip is lossy: Ledger is 12179300 EMU = 1278.5px,
	 * and the integer pixel it rounds to would cost the deck its preset.
	 */
	onUpdateSlideSize?: (size: SlideSizeEmu) => void;
}

export function SlideSizeCard({
	canvasSize,
	slideSizeEmu,
	canEdit,
	onUpdate,
	onUpdateSlideSize,
}: SlideSizeCardProps): React.ReactElement {
	const { t } = useTranslation();
	const selection = resolveSlideSizeSelection({ current: slideSizeEmu, canvas: canvasSize });
	const presetDisabled = !canEdit || !onUpdateSlideSize;

	const handlePreset = (labelKey: string): void => {
		const preset = SLIDE_SIZE_PRESETS.find((candidate) => candidate.labelKey === labelKey);
		if (!preset) {
			return;
		}
		onUpdateSlideSize?.(slideSizeFromPreset(preset, selection.orientation));
	};

	const handleOrientation = (orientation: SlideSizeOrientation): void => {
		onUpdateSlideSize?.(withSlideSizeOrientation(selection.size, orientation));
	};

	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.slideSize.title')}</div>
			<div className='space-y-1.5 text-[11px]'>
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground'>{t('pptx.slideSize.presets')}</span>
					<select
						data-pptx-slide-size-preset
						disabled={presetDisabled}
						className={INPUT}
						value={selection.preset?.labelKey ?? CUSTOM_PRESET_VALUE}
						onChange={(e) => handlePreset(e.target.value)}
					>
						{/* Only offered while the size actually is custom: picking
						    "Custom" is not an instruction PowerPoint can carry out. */}
						{selection.preset === undefined && (
							<option value={CUSTOM_PRESET_VALUE}>{t('pptx.slideSize.customSize')}</option>
						)}
						{SLIDE_SIZE_PRESETS.map((preset) => (
							<option key={preset.labelKey} value={preset.labelKey}>
								{t(`pptx.slideSize.preset.${preset.labelKey}`)}
							</option>
						))}
					</select>
				</label>

				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground'>{t('pptx.slideSize.orientation')}</span>
					<select
						data-pptx-slide-size-orientation
						disabled={presetDisabled}
						className={INPUT}
						value={selection.orientation}
						onChange={(e) => handleOrientation(e.target.value as SlideSizeOrientation)}
					>
						<option value='landscape'>{t('pptx.slideSize.landscape')}</option>
						<option value='portrait'>{t('pptx.slideSize.portrait')}</option>
					</select>
				</label>

				<div className='grid grid-cols-2 gap-1.5'>
					{(
						[
							['W', 'width'],
							['H', 'height'],
						] as const
					).map(([label, key]) => (
						<label key={key} className='flex items-center gap-1'>
							<span className='text-muted-foreground'>{label}</span>
							<input
								type='number'
								className={INPUT}
								disabled={!canEdit}
								value={canvasSize[key]}
								onChange={(e) => onUpdate({ ...canvasSize, [key]: Number(e.target.value) })}
							/>
						</label>
					))}
				</div>
			</div>
		</div>
	);
}
