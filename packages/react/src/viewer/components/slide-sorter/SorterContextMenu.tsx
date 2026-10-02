import {
	buildSlideSorterContextMenuEntries,
	slideSorterContextMenuLabel,
} from 'pptx-viewer-shared';
import type { SlideSorterContextMenuCommandId } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuClipboardPaste, LuCopy, LuCopyPlus, LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

import type { SlideSectionGroup } from '../../types';
import { ContextMenuSeparator } from '../context-menu-parts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SorterContextMenuProps {
	x: number;
	y: number;
	selectedCount: number;
	/** Deck size, so deleting every slide can be refused. */
	totalSlides: number;
	hasClipboard: boolean;
	hasHiddenInSelection: boolean;
	hasVisibleInSelection: boolean;
	sectionGroups: SlideSectionGroup[];
	onDelete: () => void;
	onDuplicate: () => void;
	onCopy: () => void;
	onPaste: () => void;
	onToggleHide: () => void;
	onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ICON_CLASS = 'h-3.5 w-3.5 text-muted-foreground';

/**
 * The sorter tile right-click menu. The command list, Hide/Show toggle, count
 * suffix and Delete gating come from the shared
 * `buildSlideSorterContextMenuEntries`, so this menu cannot drift from the
 * other four bindings.
 */
export function SorterContextMenu({
	x,
	y,
	selectedCount,
	totalSlides,
	hasClipboard,
	hasHiddenInSelection,
	hasVisibleInSelection,
	sectionGroups: _sectionGroups,
	onDelete,
	onDuplicate,
	onCopy,
	onPaste,
	onToggleHide,
	onClose,
}: SorterContextMenuProps): React.ReactElement {
	const { t } = useTranslation();

	// Constrain position to viewport
	const menuX = Math.max(8, Math.min(x, window.innerWidth - 220));
	const menuY = Math.max(8, Math.min(y, window.innerHeight - 300));

	const entries = buildSlideSorterContextMenuEntries({
		selectedCount,
		hasClipboard,
		hasHiddenInSelection,
		hasVisibleInSelection,
		wouldDeleteAllSlides: selectedCount >= totalSlides,
	});

	const handlers: Record<SlideSorterContextMenuCommandId, () => void> = {
		copy: onCopy,
		paste: onPaste,
		duplicate: onDuplicate,
		'toggle-hidden': onToggleHide,
		delete: onDelete,
	};
	const icons: Record<SlideSorterContextMenuCommandId, React.ReactElement> = {
		copy: <LuCopy className={ICON_CLASS} />,
		paste: <LuClipboardPaste className={ICON_CLASS} />,
		duplicate: <LuCopyPlus className={ICON_CLASS} />,
		'toggle-hidden':
			hasVisibleInSelection || !hasHiddenInSelection ? (
				<LuEyeOff className={ICON_CLASS} />
			) : (
				<LuEye className={ICON_CLASS} />
			),
		delete: <LuTrash2 className='h-3.5 w-3.5' />,
	};

	return (
		<>
			{/* Backdrop to close */}
			<div
				className='fixed inset-0 z-[119]'
				onClick={onClose}
				onContextMenu={(e) => {
					e.preventDefault();
					onClose();
				}}
			/>
			<div
				data-pptx-context-menu='true'
				data-pptx-sorter-context-menu='true'
				role='menu'
				aria-label={t('pptx.slideSorter.title')}
				className='fixed z-[120] min-w-[200px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground'
				style={{ left: menuX, top: menuY }}
			>
				{entries.map((entry) => (
					<span key={entry.id}>
						{entry.separatorBefore && <ContextMenuSeparator />}
						<button
							type='button'
							role='menuitem'
							disabled={entry.disabled}
							className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-40 ${
								entry.id === 'delete' ? 'text-red-300 hover:bg-red-900/40' : 'hover:bg-muted'
							}`}
							onClick={handlers[entry.id]}
						>
							{icons[entry.id]}
							{slideSorterContextMenuLabel(t(entry.labelKey), entry, selectedCount)}
						</button>
					</span>
				))}
			</div>
		</>
	);
}
