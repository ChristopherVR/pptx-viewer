import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import {
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	strokeWidthOf,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuGroup, LuUngroup } from 'react-icons/lu';

import { gB, gL, grp, ic } from './toolbar-constants';

export interface ShapeArrangeExtrasProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds; Group needs two. */
	selectedCount: number;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
}

/**
 * The Arrange group's shape-level extras: Group, Ungroup, and the outline
 * width spinner.
 *
 * Kept out of `ArrangeSection` so neither file drifts past the 300-LOC budget,
 * and grouped together because all three are gated on the same thing: a
 * selection that is actually a shape (or, for Group, two of them). They were
 * shipped by the Svelte binding first and missing from React, which made React
 * the thin side of the ribbon comparison rather than the reference it is meant
 * to be.
 */
export function ShapeArrangeExtras(p: ShapeArrangeExtrasProps): React.ReactElement {
	const { t } = useTranslation();
	const canGroup = canGroupSelection(p.canEdit, p.selectedCount);
	const canUngroup = canUngroupSelection(p.canEdit, p.selectedElement);
	const canStrokeWidth = canSetStrokeWidth(p.canEdit, p.selectedElement);
	const strokeWidth = strokeWidthOf(p.selectedElement);

	return (
		<>
			<div className={grp}>
				<button
					type='button'
					onClick={p.onGroupElements}
					disabled={!canGroup}
					className={gB}
					title={t('pptx.contextMenu.group')}
					aria-label={t('pptx.contextMenu.group')}
				>
					<LuGroup className={ic} />
				</button>
				<button
					type='button'
					onClick={p.onUngroupElement}
					disabled={!canUngroup}
					className={gL}
					title={t('pptx.contextMenu.ungroup')}
					aria-label={t('pptx.contextMenu.ungroup')}
				>
					<LuUngroup className={ic} />
				</button>
			</div>
			<input
				type='number'
				min='0'
				max='120'
				step='0.5'
				disabled={!canStrokeWidth}
				// Named explicitly: the spinner has no visible caption in the ribbon,
				// so without this it announces itself as an anonymous number box.
				aria-label={t('pptx.ribbon.strokeWidth')}
				title={t('pptx.ribbon.strokeWidth')}
				value={strokeWidth}
				onChange={(event) => {
					const next = Number(event.target.value);
					if (Number.isFinite(next)) {
						p.onUpdateElementStyle({ strokeWidth: Math.max(0, next) });
					}
				}}
				className='h-[26px] w-[52px] rounded border border-border bg-muted px-1 text-center text-[11px] text-foreground disabled:opacity-40'
			/>
		</>
	);
}
