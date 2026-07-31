import type { SmartArtColorScheme, SmartArtStyle } from 'pptx-viewer-core';
import {
	schemaLabel,
	SMARTART_COLOR_SCHEME_LABEL_KEYS,
	SMARTART_STYLE_LABEL_KEYS,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { INPUT } from './inspector-pane-constants';

/**
 * Colour-scheme select + style toggle group for the SmartArt inspector.
 *
 * Lifted out of `SmartArtPropertiesPanel` purely to keep that file inside the
 * per-file line budget; the markup, testids and accessible names are unchanged.
 *
 * Both controls render OOXML wire tokens (`dgm:colorsDef` families such as
 * `colorful1`, `dgm:styleDef` intensities such as `flat`). Only their visible
 * text is spelled via the shared catalogues: the option VALUES and the button
 * payloads stay the raw tokens, so the deck still receives exactly what it did
 * before and the control stays in parity with the other bindings.
 */
export interface SmartArtStyleControlsProps {
	colorSchemes: readonly SmartArtColorScheme[];
	styleOptions: readonly SmartArtStyle[];
	colorScheme: SmartArtColorScheme;
	style: SmartArtStyle;
	canEdit: boolean;
	onChangeColorScheme: (scheme: SmartArtColorScheme) => void;
	onChangeStyle: (style: SmartArtStyle) => void;
}

export function SmartArtStyleControls({
	colorSchemes,
	styleOptions,
	colorScheme,
	style,
	canEdit,
	onChangeColorScheme,
	onChangeStyle,
}: SmartArtStyleControlsProps): React.ReactElement {
	const { t } = useTranslation();
	// `schemaLabel` takes a plain `(key) => string`; react-i18next's `t` is an
	// overloaded generic, so narrow it once instead of at every call site.
	const translate = React.useCallback((key: string): string => t(key), [t]);

	return (
		<>
			<label className='flex flex-col gap-1 text-[11px]'>
				<span className='text-muted-foreground'>{t('pptx.smartart.colorScheme')}</span>
				<select
					disabled={!canEdit}
					data-testid='smartart-color-scheme'
					aria-label={t('pptx.smartart.colorScheme')}
					className={cn(INPUT, 'w-full')}
					value={colorScheme}
					onChange={(e) => onChangeColorScheme(e.target.value as SmartArtColorScheme)}
				>
					{colorSchemes.map((cs) => (
						<option key={cs} value={cs}>
							{schemaLabel(SMARTART_COLOR_SCHEME_LABEL_KEYS, cs, translate)}
						</option>
					))}
				</select>
			</label>

			<label className='flex flex-col gap-1 text-[11px]'>
				<span className='text-muted-foreground'>{t('pptx.smartart.style')}</span>
				<div className='flex gap-1' role='group' aria-label={t('pptx.smartart.style')}>
					{styleOptions.map((s) => (
						<button
							key={s}
							type='button'
							disabled={!canEdit}
							aria-pressed={style === s}
							className={cn(
								'flex-1 px-2 py-1 text-[10px] rounded border transition-colors',
								style === s
									? 'border-primary bg-primary/20 text-primary'
									: 'border-border text-muted-foreground hover:bg-muted',
							)}
							onClick={() => onChangeStyle(s)}
						>
							{schemaLabel(SMARTART_STYLE_LABEL_KEYS, s, translate)}
						</button>
					))}
				</div>
			</label>
		</>
	);
}
