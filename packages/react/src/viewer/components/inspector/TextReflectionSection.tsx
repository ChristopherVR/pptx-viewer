import type { TextStyle } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { INPUT_CLS } from './TextPropertiesHelpers';

// ---------------------------------------------------------------------------
// TextReflectionSection
// ---------------------------------------------------------------------------

/**
 * The "Text Reflection" toggle + fields, extracted out of `TextEffectsPanel`
 * to keep that file inside the per-file line budget; markup and behaviour
 * are unchanged. Reflection has no colour field (it renders a mirrored copy
 * of the text itself), so unlike Shadow/Glow it needs no recent-colours push.
 */
export function TextReflectionSection({
	ts,
	onUpdateTextStyle,
	numChange,
}: {
	ts: TextStyle | undefined;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	numChange: (
		fn: (v: number) => Partial<TextStyle>,
	) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	const hasReflection = Boolean(ts?.textReflection);

	return (
		<div className='space-y-1.5'>
			<label className='inline-flex items-center gap-2 text-foreground'>
				<input
					type='checkbox'
					checked={hasReflection}
					onChange={(e) => {
						if (e.target.checked) {
							onUpdateTextStyle({
								textReflection: true,
								textReflectionBlur: 1,
								textReflectionStartOpacity: 0.5,
								textReflectionEndOpacity: 0,
								textReflectionOffset: 3,
							});
						} else {
							onUpdateTextStyle({
								textReflection: undefined,
								textReflectionBlur: undefined,
								textReflectionStartOpacity: undefined,
								textReflectionEndOpacity: undefined,
								textReflectionOffset: undefined,
							});
						}
					}}
				/>
				{t('pptx.textEffects.reflection')}
			</label>
			{hasReflection && (
				<div className='grid grid-cols-2 gap-2 pl-4'>
					<label className='flex flex-col gap-1'>
						<span className='text-muted-foreground'>Blur</span>
						<input
							type='number'
							min={0}
							max={20}
							step={0.5}
							value={Number(ts?.textReflectionBlur ?? 1).toFixed(1)}
							onChange={numChange((v) => ({
								textReflectionBlur: Math.max(0, Math.min(20, v)),
							}))}
							className={INPUT_CLS}
						/>
					</label>
					<label className='flex flex-col gap-1'>
						<span className='text-muted-foreground'>Offset</span>
						<input
							type='number'
							min={0}
							max={20}
							step={1}
							value={Math.round(ts?.textReflectionOffset ?? 3)}
							onChange={numChange((v) => ({
								textReflectionOffset: Math.max(0, Math.min(20, v)),
							}))}
							className={INPUT_CLS}
						/>
					</label>
					<label className='flex flex-col gap-1'>
						<span className='text-muted-foreground'>{t('pptx.textEffects.startOpacity')}</span>
						<input
							type='number'
							min={0}
							max={1}
							step={0.05}
							value={Number(ts?.textReflectionStartOpacity ?? 0.5).toFixed(2)}
							onChange={numChange((v) => ({
								textReflectionStartOpacity: Math.max(0, Math.min(1, v)),
							}))}
							className={INPUT_CLS}
						/>
					</label>
					<label className='flex flex-col gap-1'>
						<span className='text-muted-foreground'>{t('pptx.textEffects.endOpacity')}</span>
						<input
							type='number'
							min={0}
							max={1}
							step={0.05}
							value={Number(ts?.textReflectionEndOpacity ?? 0).toFixed(2)}
							onChange={numChange((v) => ({
								textReflectionEndOpacity: Math.max(0, Math.min(1, v)),
							}))}
							className={INPUT_CLS}
						/>
					</label>
				</div>
			)}
		</div>
	);
}
