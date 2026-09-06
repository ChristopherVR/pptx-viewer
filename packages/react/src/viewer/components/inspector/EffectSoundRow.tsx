import { EFFECT_SOUND_CATALOGUE, getEffectSoundAsset } from 'pptx-viewer-shared';
import type { EffectSoundState } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlay } from 'react-icons/lu';

import { playAnimationSound } from '../../utils/animation-sound';
import { SELECT_CLS } from './animation-panel-constants';

const NONE_VALUE = 'none';
const CURRENT_VALUE = 'current';
const OTHER_VALUE = 'other';

export interface EffectSoundRowProps {
	soundState: EffectSoundState;
	canEdit: boolean;
	/** `undefined` clears the sound ("No Sound"); otherwise a freshly-picked custom file. */
	onPick: (pick: { dataUrl: string; fileName?: string } | undefined) => void;
	/** Picks one of PowerPoint's 19 built-in stock sounds by catalogue id. */
	onPickStock: (catalogueId: string) => void;
}

/**
 * The animation panel's effect sound row: PowerPoint's own gallery of 19
 * built-in stock sounds, "No Sound", and "Other Sound..." (a custom audio
 * file picked from disk), plus a Preview button for the currently-selected
 * stock sound. Picking a file (or a stock sound) stages it as a pending
 * `data:` URL; the core save pipeline embeds it and mints its relationship,
 * writing the stock catalogue's canonical name so PowerPoint recognises it.
 */
export function EffectSoundRow({
	soundState,
	canEdit,
	onPick,
	onPickStock,
}: EffectSoundRowProps): React.ReactElement {
	const { t } = useTranslation();
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const selectedValue =
		soundState.catalogueId ?? (soundState.hasSound ? CURRENT_VALUE : NONE_VALUE);

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		const value = event.target.value;
		if (value === OTHER_VALUE) {
			fileInputRef.current?.click();
			return;
		}
		if (value === NONE_VALUE) {
			onPick(undefined);
			return;
		}
		if (value === CURRENT_VALUE) {
			return;
		}
		onPickStock(value);
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				onPick({ dataUrl: reader.result, fileName: file.name });
			}
		};
		reader.readAsDataURL(file);
	};

	const handlePreview = (): void => {
		if (!soundState.catalogueId) {
			return;
		}
		const asset = getEffectSoundAsset(soundState.catalogueId);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	};

	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground text-[11px]'>{t('pptx.animation.sound')}</span>
			<div className='flex items-center gap-1'>
				<select
					aria-label={t('pptx.animation.sound')}
					value={selectedValue}
					onChange={handleSelectChange}
					disabled={!canEdit}
					className={SELECT_CLS}
				>
					<option value={NONE_VALUE}>{t('pptx.animation.sound.none')}</option>
					{soundState.hasSound && !soundState.catalogueId && (
						<option value={CURRENT_VALUE}>
							{soundState.fileName ?? t('pptx.animation.sound.custom')}
						</option>
					)}
					{EFFECT_SOUND_CATALOGUE.map((entry) => (
						<option key={entry.id} value={entry.id}>
							{t(entry.i18nKey)}
						</option>
					))}
					<option value={OTHER_VALUE}>{t('pptx.animation.sound.other')}</option>
				</select>
				<button
					type='button'
					aria-label={t('pptx.animation.sound.preview')}
					onClick={handlePreview}
					disabled={!soundState.catalogueId}
					className='shrink-0 rounded border border-border bg-muted p-1 disabled:opacity-40'
				>
					<LuPlay className='h-3 w-3' />
				</button>
			</div>
			<input
				ref={fileInputRef}
				type='file'
				accept='audio/*'
				aria-label={t('pptx.animation.sound.chooseFile')}
				className='hidden'
				onChange={handleFileChange}
				tabIndex={-1}
			/>
		</label>
	);
}
