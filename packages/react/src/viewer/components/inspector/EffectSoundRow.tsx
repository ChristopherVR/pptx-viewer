import type { EffectSoundState } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SELECT_CLS } from './animation-panel-constants';

export interface EffectSoundRowProps {
	soundState: EffectSoundState;
	canEdit: boolean;
	/** `undefined` clears the sound ("No Sound"); otherwise a freshly-picked file. */
	onPick: (pick: { dataUrl: string; fileName?: string } | undefined) => void;
}

/**
 * The animation panel's effect sound row (`p:stSnd`): "No Sound" or a custom
 * audio file picked from disk. Picking a file stages it as a pending `data:`
 * URL; the core save pipeline embeds it and mints its relationship.
 */
export function EffectSoundRow({
	soundState,
	canEdit,
	onPick,
}: EffectSoundRowProps): React.ReactElement {
	const { t } = useTranslation();
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		if (event.target.value === 'custom') {
			fileInputRef.current?.click();
			return;
		}
		onPick(undefined);
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

	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground text-[11px]'>{t('pptx.animation.sound')}</span>
			<select
				aria-label={t('pptx.animation.sound')}
				value={soundState.hasSound ? 'custom' : 'none'}
				onChange={handleSelectChange}
				disabled={!canEdit}
				className={SELECT_CLS}
			>
				<option value='none'>{t('pptx.animation.sound.none')}</option>
				<option value='custom'>
					{soundState.hasSound && soundState.fileName
						? soundState.fileName
						: t('pptx.animation.sound.custom')}
				</option>
			</select>
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
