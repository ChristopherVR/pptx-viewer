import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import {
	buildThemeColorSwatchGrid,
	findSelectedThemeSwatch,
	themeColorSwatchRows,
	themeSwatchCommit,
} from 'pptx-viewer-shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useThemeColorMap } from './ThemeColorMapContext';

export interface ThemeColorSwatchGridProps {
	/** Unique key prefix for React list keys (e.g. `"fill"`, `"stroke"`). */
	prefix: string;
	disabled?: boolean;
	/** The element's current theme ref, if any (used to highlight the matching swatch). */
	selectedRef?: PptxThemeColorRef;
	/** The element's current resolved hex, used to highlight a swatch when no ref is stored. */
	selectedHex?: string;
	/** Called when the user clicks a swatch: both the resolved hex and the ref to store. */
	onPick: (commit: ThemeColorPickerCommit) => void;
}

/**
 * PowerPoint's "Theme Colors" grid: ten columns (Background 1, Text 1,
 * Background 2, Text 2, Accent 1..6) each with a base swatch and five
 * luminance variants, built from the loaded deck's real theme colours
 * ({@link useThemeColorMap}) rather than a hard-coded Office palette.
 *
 * Renders nothing (not even the heading) when no deck theme is loaded yet,
 * so callers can render this unconditionally alongside their existing
 * hex/recent-colour controls.
 */
export function ThemeColorSwatchGrid({
	prefix,
	disabled,
	selectedRef,
	selectedHex,
	onPick,
}: ThemeColorSwatchGridProps): React.ReactElement | null {
	const { t } = useTranslation();
	const themeColorMap = useThemeColorMap();
	const columns = useMemo(() => buildThemeColorSwatchGrid(themeColorMap), [themeColorMap]);
	const rows = useMemo(() => themeColorSwatchRows(columns), [columns]);
	const selected = useMemo(
		() => findSelectedThemeSwatch(columns, selectedRef, selectedHex),
		[columns, selectedRef, selectedHex],
	);

	if (columns.length === 0) {
		return null;
	}

	return (
		<div className='mt-1'>
			<div className='text-[10px] text-muted-foreground mb-1'>
				{t('pptx.colorPicker.themeColors')}
			</div>
			<div className='flex flex-col gap-0.5'>
				{rows.map((row, rowIndex) => (
					// eslint-disable-next-line react/no-array-index-key
					<div key={`${prefix}-theme-row-${rowIndex}`} className='flex gap-0.5'>
						{row.map((swatch, colIndex) =>
							swatch ? (
								<button
									key={`${prefix}-theme-${swatch.ref.scheme}-${rowIndex}`}
									type='button'
									disabled={disabled}
									data-pptx-compact
									title={swatch.label}
									aria-label={swatch.label}
									className={`h-4 w-4 rounded-sm border transition-transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed ${
										selected === swatch ? 'border-primary ring-1 ring-primary' : 'border-border'
									}`}
									style={{ backgroundColor: swatch.hex }}
									onClick={() => onPick(themeSwatchCommit(swatch))}
								/>
							) : (
								<div key={`${prefix}-theme-empty-${rowIndex}-${colIndex}`} className='h-4 w-4' />
							),
						)}
					</div>
				))}
			</div>
		</div>
	);
}
