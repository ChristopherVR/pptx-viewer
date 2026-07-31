/**
 * The inspector's "Elements" tab: the active slide's layer order, top first.
 *
 * WHY this lives in its own module: it used to be inlined in `InspectorPane`
 * while a second, unreachable `ElementsTab.tsx` carried the one capability the
 * live list lacked (per-element hide/show). Lifting the list out and folding the
 * eye toggle in leaves a single Elements list in the tree, and keeps
 * `InspectorPane` a thin shell instead of pushing it past the file-size limit.
 *
 * Visibility is written through `onUpdateSlide` rather than a dedicated
 * callback: the inspector already owns a merge-into-the-active-slide patch
 * channel, so toggling `hidden` needs no new plumbing through the viewer shell.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuEye, LuEyeOff } from 'react-icons/lu';

import { cn } from '../../utils';
import { HEADING } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InspectorElementsTabProps {
	/** Slide whose elements are listed, or `undefined` when none is active. */
	activeSlide: PptxSlide | undefined;
	/** Primary selection, highlighted in the list. */
	selectedElementId: string | null;
	/** Every selected id (multi-select highlights all of them). */
	selectedElementIds: string[];
	/** Editing gate: the visibility toggle is read-only without it. */
	canEdit: boolean;
	/** Select an element by clicking its row. */
	onSelectElement: (elementId: string | null) => void;
	/** Merge a patch into the active slide (used to rewrite `elements`). */
	onUpdateSlide: (updates: Partial<PptxSlide>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Short, human-readable stand-in for an element in the layer list. */
function elementLabel(element: PptxElement): string {
	const text = hasTextProperties(element) ? (element.text || '').slice(0, 24) : undefined;
	return text || element.type;
}

export function InspectorElementsTab({
	activeSlide,
	selectedElementId,
	selectedElementIds,
	canEdit,
	onSelectElement,
	onUpdateSlide,
}: InspectorElementsTabProps): React.ReactElement {
	const { t } = useTranslation();

	const toggleHidden = (elementId: string): void => {
		const elements = activeSlide?.elements;
		if (!canEdit || !elements) {
			return;
		}
		const index = elements.findIndex((el) => el.id === elementId);
		if (index === -1) {
			return;
		}
		const next = [...elements];
		next[index] = { ...next[index], hidden: !next[index].hidden } as PptxElement;
		onUpdateSlide({ elements: next });
	};

	if (!activeSlide) {
		return (
			<div className='space-y-1'>
				<div className={cn(HEADING, 'mb-2')}>{t('pptx.inspector.layerOrder')}</div>
				<div className='text-muted-foreground italic'>{t('pptx.inspector.noSlideSelected')}</div>
			</div>
		);
	}

	const elements = activeSlide.elements || [];

	return (
		<div className='space-y-1' data-pptx-elements-tab>
			<div className={cn(HEADING, 'mb-2')}>{t('pptx.inspector.layerOrder')}</div>
			{[...elements].reverse().map((el, reversedIndex) => {
				const index = elements.length - 1 - reversedIndex;
				const selected = selectedElementId === el.id || selectedElementIds.includes(el.id);
				return (
					<div
						key={el.id}
						title={`${el.type} - ${el.id}`}
						className={cn(
							'flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors',
							selected ? 'bg-primary/30 text-primary' : 'hover:bg-muted text-foreground',
						)}
						onClick={() => onSelectElement(el.id)}
					>
						<span className='text-muted-foreground w-4 text-right'>{index + 1}</span>
						<span className='flex-1 truncate'>{elementLabel(el)}</span>
						<button
							type='button'
							disabled={!canEdit}
							data-pptx-element-visibility={el.id}
							aria-pressed={Boolean(el.hidden)}
							className='text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed'
							title={
								el.hidden
									? t('pptx.selectionPane.showElement')
									: t('pptx.selectionPane.hideElement')
							}
							onClick={(event) => {
								// The row itself selects; the eye must not change the selection.
								event.stopPropagation();
								toggleHidden(el.id);
							}}
						>
							{el.hidden ? (
								<LuEyeOff className='w-3.5 h-3.5' />
							) : (
								<LuEye className='w-3.5 h-3.5 opacity-50' />
							)}
						</button>
					</div>
				);
			})}
		</div>
	);
}
