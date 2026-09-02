import React from 'react';
import { useTranslation } from 'react-i18next';

import { useRecentColors } from './RecentColorsContext';

// ---------------------------------------------------------------------------
// RecentColorsRow
// ---------------------------------------------------------------------------

/**
 * The "Recent colours" row shared by every colour picker in the inspector
 * and the ribbon: sourced from {@link useRecentColors} (context), so every
 * caller renders the SAME list rather than re-deriving it. Extracted out of
 * `ColorPickerRow` (which still uses it) so pickers that are not built on
 * `ColorPickerRow`'s full swatch/eyedropper layout - the text colour field,
 * the ribbon's font-colour menu, the shape fill/outline popovers - can
 * render the identical row without copy-pasting its markup.
 *
 * Renders nothing (not even a `hidden` wrapper) while the list is empty, so
 * a caller can render it unconditionally. Clicking a swatch both calls
 * `onCommit` (the picker's own apply path) AND pushes the colour back to the
 * front of the shared list itself, so every caller gets the row's full
 * contract for free without also having to remember to push.
 */
export function RecentColorsRow({
	prefix,
	disabled,
	onCommit,
}: {
	/** Prefix for each swatch button's React key, unique per picker instance. */
	prefix: string;
	disabled?: boolean;
	/** Applies the picked colour through the picker's own commit path. */
	onCommit: (color: string) => void;
}): React.ReactElement | null {
	const { t } = useTranslation();
	const { recentColors, pushColor } = useRecentColors();

	if (recentColors.length === 0) {
		return null;
	}

	return (
		<div
			data-testid='pptx-color-recent'
			aria-label={t('pptx.colorPicker.recentColors')}
			className='mt-1 flex flex-wrap items-center gap-1'
		>
			<span className='text-[9px] text-muted-foreground'>{t('pptx.colorPicker.recentColors')}</span>
			{recentColors.map((c) => (
				<button
					key={`${prefix}-recent-${c}`}
					type='button'
					data-pptx-compact
					className='h-4 w-4 rounded border border-primary'
					style={{ backgroundColor: c }}
					title={c}
					aria-label={`Recent ${c}`}
					disabled={disabled}
					onClick={() => {
						onCommit(c);
						pushColor(c);
					}}
				/>
			))}
		</div>
	);
}
