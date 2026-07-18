import {
	getQuickAccessCommand,
	resolveScreenTip,
	TITLE_BAR_CLASSES as TB,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import {
	LuFileDown,
	LuPlay,
	LuPlus,
	LuPrinter,
	LuRedo,
	LuSave,
	LuSpellCheck,
	LuUndo,
	LuZoomIn,
	LuZoomOut,
} from 'react-icons/lu';

import { cn } from '../../utils';
import { useViewerOptionsContext } from '../viewer-options-context';

/** Catalog icon name -> Lucide component. */
const QUICK_ACCESS_ICONS: Record<string, IconType> = {
	save: LuSave,
	undo: LuUndo,
	redo: LuRedo,
	play: LuPlay,
	printer: LuPrinter,
	fileDown: LuFileDown,
	plus: LuPlus,
	spellCheck: LuSpellCheck,
	zoomIn: LuZoomIn,
	zoomOut: LuZoomOut,
};

export interface QuickAccessToolbarProps {
	/** Execute a catalog command id (see `QUICK_ACCESS_COMMAND_CATALOG`). */
	onCommand: (id: string) => void;
	/** Per-command disabled state (e.g. undo/redo availability). */
	isCommandDisabled?: (id: string) => boolean;
	/** Per-command tooltip label override (e.g. "Undo: Delete shape"). */
	commandTitleOverrides?: Partial<Record<string, string>>;
	/** Rendered below the ribbon instead of inside the title bar. */
	placement?: 'titleBar' | 'belowRibbon';
}

/**
 * Options-driven Quick Access Toolbar strip. Command list, order, label
 * visibility, and overall visibility come from
 * `options.quickAccess`; each id maps onto an existing viewer handler via
 * `onCommand`. Rendered in the title bar (position `above`) or in a row
 * under the ribbon (position `below`).
 */
export function QuickAccessToolbar(p: QuickAccessToolbarProps): React.ReactElement | null {
	const { t } = useTranslation();
	const options = useViewerOptionsContext();
	const { visible, commandIds, showCommandLabels } = options.quickAccess;
	if (!visible) {
		return null;
	}
	const commands = commandIds
		.map((id) => getQuickAccessCommand(id))
		.filter((command): command is NonNullable<typeof command> => command !== undefined);
	if (commands.length === 0) {
		return null;
	}
	const below = p.placement === 'belowRibbon';
	return (
		<span
			data-pptx-quick-access={below ? 'below' : 'above'}
			className={cn('flex items-center', below && 'gap-0.5 border-b border-border/60 px-2 py-0.5')}
		>
			{commands.map((command) => {
				const Icon = QUICK_ACCESS_ICONS[command.icon] ?? LuSave;
				const label = p.commandTitleOverrides?.[command.id] ?? t(command.labelKey);
				const disabled = p.isCommandDisabled?.(command.id) ?? false;
				return (
					<button
						key={command.id}
						type='button'
						onClick={() => p.onCommand(command.id)}
						disabled={disabled}
						className={cn(TB.quickButton, 'inline-flex items-center', showCommandLabels && 'gap-1')}
						title={resolveScreenTip(options, label)}
						aria-label={t(command.labelKey)}
					>
						<Icon className='w-3.5 h-3.5' />
						{showCommandLabels && (
							<span className='text-[11px] whitespace-nowrap'>{t(command.labelKey)}</span>
						)}
					</button>
				);
			})}
		</span>
	);
}
