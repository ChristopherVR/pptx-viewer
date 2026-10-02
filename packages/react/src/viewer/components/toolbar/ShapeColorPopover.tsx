import type { PptxThemeColorRef } from 'pptx-viewer-core';
import { RIBBON_SHAPE_SWATCHES } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RecentColorsRow } from '../inspector/RecentColorsRow';
import { ThemeColorSwatchGrid } from '../inspector/ThemeColorSwatchGrid';
import { RibbonMenu } from './RibbonMenu';

// ---------------------------------------------------------------------------
// ShapeColorPopover
// ---------------------------------------------------------------------------

/**
 * The ribbon's Shape Fill / Shape Outline popover: the deck's real theme
 * colours ({@link ThemeColorSwatchGrid}) above a preset standard-colour grid
 * and the shared "Recent colours" row. Fill and Outline used to duplicate
 * this markup (only the applied colour handler differed), which is exactly
 * the "same edit in two places" signal CLAUDE.md calls out as an extraction
 * trigger; both now render this one component.
 *
 * A theme swatch commits both the resolved hex and its `PptxThemeColorRef`
 * (so the fill/outline keeps following the theme after a later theme
 * change); a standard or recent swatch always clears the ref, since a plain
 * hex has no theme identity for PowerPoint to reapply.
 */
export function ShapeColorPopover({
	prefix,
	anchorRef,
	disabled,
	swatchAriaLabel,
	selectedRef,
	selectedHex,
	onApply,
	onClose,
}: {
	/** Prefix for swatch/row React keys and testids, unique per popover instance. */
	prefix: string;
	anchorRef: React.RefObject<HTMLElement | null>;
	disabled: boolean;
	/** e.g. "Fill colour" / "Outline colour", prefixed to each swatch's aria-label. */
	swatchAriaLabel: string;
	/** The selected shape's current theme ref, if any (highlights the matching theme swatch). */
	selectedRef?: PptxThemeColorRef;
	/** The selected shape's current resolved hex, used to highlight when no ref is stored. */
	selectedHex?: string;
	/** Apply the picked colour (and ref, for a theme-swatch pick) to the selected shape. */
	onApply: (color: string, ref?: PptxThemeColorRef) => void;
	onClose: () => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<RibbonMenu anchorRef={anchorRef} className='pt-1'>
			<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2'>
				<ThemeColorSwatchGrid
					prefix={prefix}
					disabled={disabled}
					selectedRef={selectedRef}
					selectedHex={selectedHex}
					onPick={(c) => {
						onApply(c.hex, c.ref);
						onClose();
					}}
				/>
				<div className='mt-1 text-[10px] text-muted-foreground mb-1'>
					{t('pptx.colorPicker.standardColors')}
				</div>
				<div className='grid grid-cols-6 gap-1'>
					{RIBBON_SHAPE_SWATCHES.map((c) => (
						<button
							key={c}
							type='button'
							aria-label={`${swatchAriaLabel} ${c}`}
							data-pptx-compact
							className='w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform'
							style={{ backgroundColor: c }}
							title={c}
							onClick={() => {
								onApply(c);
								onClose();
							}}
						/>
					))}
				</div>
				<RecentColorsRow
					prefix={prefix}
					disabled={disabled}
					onCommit={(c) => {
						onApply(c);
						onClose();
					}}
				/>
			</div>
		</RibbonMenu>
	);
}
