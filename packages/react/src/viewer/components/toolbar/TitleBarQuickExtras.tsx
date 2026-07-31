import { extraQuickAccessCommands, TITLE_BAR_CLASSES as TB } from 'pptx-viewer-shared';
import type { ViewerQuickAccessOptions } from 'pptx-viewer-shared';
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

/** Catalog icon name -> Lucide component (the map every binding's strip uses). */
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

export interface TitleBarQuickExtrasProps {
	/** Live File > Options > Quick Access Toolbar group. */
	quickAccess: ViewerQuickAccessOptions;
	/** Run a catalog command id. */
	onCommand?: (id: string) => void;
}

/**
 * The Quick Access commands the title bar renders BEYOND its dedicated
 * Save/Undo/Redo buttons, in the order File > Options configures.
 *
 * Split out of `TitleBar` for two reasons: the title bar was over this repo's
 * file-size budget, and the strip's contents are the one piece of chrome that
 * is options-driven rather than fixed, so it reads better as its own unit. The
 * dedicated trio stays in the title bar because it carries state this has no
 * way to know (undo/redo enablement, the "Undo: <action>" tooltip, and the
 * host's `hiddenActions` gate).
 */
export function TitleBarQuickExtras(p: TitleBarQuickExtrasProps): React.ReactElement | null {
	const { t } = useTranslation();
	if (!p.quickAccess.visible) {
		return null;
	}
	const commands = extraQuickAccessCommands(p.quickAccess.commandIds);
	if (commands.length === 0) {
		return null;
	}
	return (
		<>
			{commands.map((command) => {
				const Icon = QUICK_ACCESS_ICONS[command.icon] ?? LuPlay;
				const label = t(command.labelKey);
				return (
					<button
						key={command.id}
						type='button'
						onClick={() => p.onCommand?.(command.id)}
						className={TB.quickButton}
						title={label}
						aria-label={label}
					>
						<Icon className='w-3.5 h-3.5' />
					</button>
				);
			})}
		</>
	);
}
