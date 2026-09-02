import { RIBBON_SHAPE_SWATCHES } from 'pptx-viewer-shared';
import React from 'react';

import { RecentColorsRow } from '../inspector/RecentColorsRow';
import { RibbonMenu } from './RibbonMenu';
import { pill } from './toolbar-constants';

// ---------------------------------------------------------------------------
// ShapeColorPopover
// ---------------------------------------------------------------------------

/**
 * The ribbon's Shape Fill / Shape Outline popover: a preset swatch grid plus
 * the shared "Recent colours" row. Fill and Outline used to duplicate this
 * markup (only the applied colour handler differed), which is exactly the
 * "same edit in two places" signal CLAUDE.md calls out as an extraction
 * trigger; both now render this one component.
 */
export function ShapeColorPopover({
	icon,
	title,
	prefix,
	anchorRef,
	open,
	onToggle,
	disabled,
	swatchAriaLabel,
	onApply,
	onClose,
}: {
	icon: React.ReactNode;
	title: string;
	/** Prefix for swatch/row React keys and testids, unique per popover instance. */
	prefix: string;
	anchorRef: React.RefObject<HTMLDivElement | null>;
	open: boolean;
	onToggle: () => void;
	disabled: boolean;
	/** e.g. "Fill colour" / "Outline colour", prefixed to each swatch's aria-label. */
	swatchAriaLabel: string;
	/** Apply the picked colour to the selected shape (and push it to Recent). */
	onApply: (color: string) => void;
	onClose: () => void;
}): React.ReactElement {
	return (
		<div className='relative' ref={anchorRef}>
			<button type='button' disabled={disabled} className={pill} title={title} onClick={onToggle}>
				{icon}
			</button>
			{open && (
				<RibbonMenu anchorRef={anchorRef} className='pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2'>
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
			)}
		</div>
	);
}
