import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlidePaneContextMenuEntries } from 'pptx-viewer-shared';
import type React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ContextMenuItem, ContextMenuSeparator } from '../context-menu-parts';
import type { SlideContextMenuState } from './types';

/**
 * The thumbnail right-click menu: New Slide, Duplicate, Delete, Layout, Hide,
 * Add Section, driven by the shared `buildSlidePaneContextMenuEntries` list so
 * this menu cannot drift from the other four bindings' one command at a time.
 */
interface SlideContextMenuProps {
	state: SlideContextMenuState;
	slides: PptxSlide[];
	onAddSlideAfter: (index: number) => void;
	onDuplicateSlides: (indexes: number[]) => void;
	onDeleteSlides: (indexes: number[]) => void;
	onHideSlides: (indexes: number[]) => void;
	onOpenLayoutForSlide: (index: number, x: number, y: number) => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onClose: () => void;
}

export function SlideContextMenu({
	state,
	slides,
	onAddSlideAfter,
	onDuplicateSlides,
	onDeleteSlides,
	onHideSlides,
	onOpenLayoutForSlide,
	onAddSection,
	onClose,
}: SlideContextMenuProps): React.ReactElement {
	const { t } = useTranslation();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	const selected = state.selectedIndexes;
	const selectedSlides = selected.map((i) => slides[i]).filter((s): s is PptxSlide => Boolean(s));
	const entries = buildSlidePaneContextMenuEntries({
		selectedCount: selected.length,
		hasHiddenInSelection: selectedSlides.some((s) => s.hidden),
		hasVisibleInSelection: selectedSlides.some((s) => !s.hidden),
		wouldDeleteAllSlides: selected.length >= slides.length,
	});

	const run = (id: (typeof entries)[number]['id']): void => {
		switch (id) {
			case 'new-slide':
				onAddSlideAfter(state.slideIndex);
				break;
			case 'duplicate':
				onDuplicateSlides(selected);
				break;
			case 'delete':
				onDeleteSlides(selected);
				break;
			case 'layout':
				onOpenLayoutForSlide(state.slideIndex, state.x, state.y);
				break;
			case 'hide':
				onHideSlides(selected);
				break;
			case 'add-section':
				onAddSection?.(t('pptx.sections.defaultName'), state.slideIndex);
				break;
			default:
				break;
		}
		onClose();
	};

	return (
		<>
			<div className='fixed inset-0 z-[119]' onClick={onClose} />
			<div
				data-pptx-context-menu='true'
				data-pptx-slide-pane-context-menu='true'
				role='menu'
				aria-label={t('pptx.slidesPane.contextMenu.newSlide')}
				className='fixed z-[120] min-w-[190px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground'
				style={{ left: state.x, top: state.y }}
			>
				{entries.map((entry) => (
					<span key={entry.id}>
						{entry.separatorBefore && <ContextMenuSeparator />}
						<ContextMenuItem
							danger={entry.id === 'delete'}
							disabled={entry.disabled}
							onSelect={() => run(entry.id)}
						>
							{entry.countLabelKey
								? t(entry.labelKey, { count: selected.length })
								: t(entry.labelKey)}
						</ContextMenuItem>
					</span>
				))}
			</div>
		</>
	);
}
