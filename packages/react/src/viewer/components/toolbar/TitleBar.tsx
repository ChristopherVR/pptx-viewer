import type { ToolbarActionId } from 'pptx-viewer-shared';
import React, { useMemo } from 'react';

import type { AutosaveStatus } from '../../hooks/useAutosave';
import type { ViewerMode } from '../../types';
import { TitleBarElement } from './TitleBarElement';

export interface TitleBarProps {
	mode: ViewerMode;
	canEdit: boolean;
	/** Display name of the open document (host-supplied). */
	fileName?: string;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled: boolean;
	/** Default true. False renders the AutoSave switch inert (host policy). */
	autosaveToggleAvailable?: boolean;
	onToggleAutosave: () => void;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	onUndo: () => void;
	onRedo: () => void;
	/** Quick-access save (downloads the .pptx). */
	onSave?: () => void;
	findReplaceOpen: boolean;
	onToggleFindReplace: () => void;
	/** Dispatch a command from the search palette. */
	onCommandSearch?: (command: string) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/**
	 * Run a Quick Access command that is not one of the dedicated
	 * Save/Undo/Redo buttons (`presentFromStart`, `print`, ...), by catalog id.
	 */
	onQuickCommand?: (id: string) => void;
	/** Host-owned collaboration indicator, projected into the `collaboration` slot. */
	collaborationSlot?: React.ReactNode;
	/** Host-owned account/presence area, projected into the `account` slot. */
	accountSlot?: React.ReactNode;
}

/**
 * PowerPoint-style title bar: a thin adapter around the shared
 * `pptx-ui-title-bar`. Rendered above (outside) the ribbon toolbar.
 */
export function TitleBar(p: TitleBarProps): React.ReactElement {
	const input = useMemo(
		() => ({
			editing: (p.mode === 'edit' || p.mode === 'master') && p.canEdit,
			fileName: p.fileName,
			isDirty: p.isDirty,
			autosaveState: p.autosaveStatus?.state,
			autosaveReason: p.autosaveStatus?.state === 'disabled' ? p.autosaveStatus.reason : undefined,
			autosaveEnabled: p.autosaveEnabled,
			autosaveToggleAvailable: p.autosaveToggleAvailable,
			canUndo: p.canUndo,
			canRedo: p.canRedo,
			undoLabel: p.undoLabel,
			redoLabel: p.redoLabel,
			hiddenActions: p.hiddenActions,
			showSave: Boolean(p.onSave),
		}),
		[
			p.mode,
			p.canEdit,
			p.fileName,
			p.isDirty,
			p.autosaveStatus,
			p.autosaveEnabled,
			p.autosaveToggleAvailable,
			p.canUndo,
			p.canRedo,
			p.undoLabel,
			p.redoLabel,
			p.hiddenActions,
			p.onSave,
		],
	);
	return (
		<TitleBarElement
			input={input}
			onToggleAutosave={p.onToggleAutosave}
			onSave={p.onSave}
			onUndo={p.onUndo}
			onRedo={p.onRedo}
			onQuickCommand={p.onQuickCommand}
			onCommandSearch={p.onCommandSearch}
			onToggleFindReplace={p.onToggleFindReplace}
		>
			{p.collaborationSlot ? (
				<div slot='collaboration' style={{ display: 'contents' }}>
					{p.collaborationSlot}
				</div>
			) : null}
			{p.accountSlot ? (
				<div slot='account' style={{ display: 'contents' }}>
					{p.accountSlot}
				</div>
			) : null}
		</TitleBarElement>
	);
}
