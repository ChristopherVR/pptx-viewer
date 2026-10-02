import { buildSectionContextMenuEntries, sectionAddAfterSlideIndex } from 'pptx-viewer-shared';
import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';
import type React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { SlideSectionGroup } from '../../types';
import { ContextMenuItem, ContextMenuSeparator } from '../context-menu-parts';
import type { SectionContextMenuState } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionContextMenuProps {
	state: SectionContextMenuState;
	sectionGroups: SlideSectionGroup[];
	totalSlides: number;
	onStartRename: (sectionId: string, currentLabel: string) => void;
	onDeleteSection?: (sectionId: string) => void;
	onMoveSectionUp?: (sectionId: string) => void;
	onMoveSectionDown?: (sectionId: string) => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The section-header right-click menu. The command list, order, separators and
 * end-of-list gating come from the shared `buildSectionContextMenuEntries`, so
 * this menu cannot drift from the other four bindings.
 */
export function SectionContextMenu({
	state,
	sectionGroups,
	totalSlides,
	onStartRename,
	onDeleteSection,
	onMoveSectionUp,
	onMoveSectionDown,
	onAddSection,
	onClose,
}: SectionContextMenuProps): React.ReactElement {
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

	const entries = buildSectionContextMenuEntries({
		sectionIndex: state.sectionIndex,
		totalSections: state.totalSections,
	});

	const run = (id: SectionContextMenuCommandId): void => {
		const group = sectionGroups.find((g) => g.id === state.sectionId);
		switch (id) {
			case 'rename':
				if (group) {
					onStartRename(state.sectionId, group.label);
				}
				return;
			case 'delete':
				onDeleteSection?.(state.sectionId);
				break;
			case 'move-up':
				onMoveSectionUp?.(state.sectionId);
				break;
			case 'move-down':
				onMoveSectionDown?.(state.sectionId);
				break;
			case 'add-after':
				if (group) {
					onAddSection?.(
						t('pptx.sections.defaultName'),
						sectionAddAfterSlideIndex(
							group.slideIndexes[group.slideIndexes.length - 1],
							totalSlides,
						),
					);
				}
				break;
			default:
				break;
		}
		onClose();
	};

	return (
		<div
			data-pptx-context-menu='true'
			data-pptx-section-context-menu='true'
			role='menu'
			tabIndex={-1}
			aria-label={t('pptx.sections.sectionButtonLabel')}
			className='fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 text-xs text-foreground shadow-xl'
			style={{ left: state.x, top: state.y }}
			onClick={(e: React.MouseEvent) => e.stopPropagation()}
		>
			{entries.map((entry) => (
				<span key={entry.id}>
					{entry.separatorBefore && <ContextMenuSeparator />}
					<ContextMenuItem disabled={entry.disabled} onSelect={() => run(entry.id)}>
						{t(entry.labelKey)}
					</ContextMenuItem>
				</span>
			))}
		</div>
	);
}
