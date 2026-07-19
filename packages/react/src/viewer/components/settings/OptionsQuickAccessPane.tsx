import type { ViewerOptions } from 'pptx-viewer-shared';
import {
	QUICK_ACCESS_COMMAND_CATALOG,
	addQuickAccessCommand,
	availableQuickAccessCommands,
	moveQuickAccessCommand,
	removeQuickAccessCommand,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

import { cn } from '../../utils';

export interface OptionsQuickAccessPaneProps {
	options: ViewerOptions;
	onQuickAccessCommandsChange: (commandIds: string[]) => void;
	onResetQuickAccess: () => void;
}

function CommandList({
	title,
	commandIds,
	selectedId,
	onSelect,
}: {
	title: string;
	commandIds: readonly string[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='flex-1'>
			<p className='mb-1 text-xs font-medium text-muted-foreground'>{title}</p>
			<div
				role='listbox'
				aria-label={title}
				className='h-48 space-y-0.5 overflow-y-auto rounded border border-border/60 p-1'
			>
				{commandIds.map((id) => {
					const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
					if (!command) {
						return null;
					}
					return (
						<button
							key={id}
							type='button'
							role='option'
							aria-selected={selectedId === id}
							onClick={() => onSelect(id)}
							className={cn(
								'flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors',
								selectedId === id
									? 'bg-primary/15 text-primary'
									: 'text-foreground hover:bg-accent',
							)}
						>
							{t(command.labelKey)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Options > Quick Access Toolbar: PowerPoint's dual-list command chooser with
 * Add/Remove, reorder arrows, and Reset over the shared command catalog.
 */
export function OptionsQuickAccessPane({
	options,
	onQuickAccessCommandsChange,
	onResetQuickAccess,
}: OptionsQuickAccessPaneProps): React.ReactElement {
	const { t } = useTranslation();
	const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
	const [selectedCurrent, setSelectedCurrent] = useState<string | null>(null);
	const current = options.quickAccess.commandIds;
	const available = availableQuickAccessCommands(current).map((entry) => entry.id);

	return (
		<div className='space-y-3'>
			<div className='flex items-stretch gap-3'>
				<CommandList
					title={t('pptx.options.quickAccess.chooseCommands')}
					commandIds={available}
					selectedId={selectedAvailable}
					onSelect={setSelectedAvailable}
				/>
				<div className='flex flex-col justify-center gap-2'>
					<button
						type='button'
						disabled={!selectedAvailable}
						onClick={() => {
							if (selectedAvailable) {
								onQuickAccessCommandsChange(addQuickAccessCommand(current, selectedAvailable));
								setSelectedAvailable(null);
							}
						}}
						className='rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
					>
						{t('pptx.options.quickAccess.add')} &gt;&gt;
					</button>
					<button
						type='button'
						disabled={!selectedCurrent}
						onClick={() => {
							if (selectedCurrent) {
								onQuickAccessCommandsChange(removeQuickAccessCommand(current, selectedCurrent));
								setSelectedCurrent(null);
							}
						}}
						className='rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
					>
						&lt;&lt; {t('pptx.options.quickAccess.remove')}
					</button>
				</div>
				<CommandList
					title={t('pptx.options.quickAccess.currentCommands')}
					commandIds={current}
					selectedId={selectedCurrent}
					onSelect={setSelectedCurrent}
				/>
				<div className='flex flex-col justify-center gap-2'>
					<button
						type='button'
						aria-label={t('pptx.options.quickAccess.moveUp')}
						disabled={!selectedCurrent}
						onClick={() => {
							if (selectedCurrent) {
								onQuickAccessCommandsChange(moveQuickAccessCommand(current, selectedCurrent, 'up'));
							}
						}}
						className='rounded border border-border p-1.5 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
					>
						<LuChevronUp className='h-4 w-4' />
					</button>
					<button
						type='button'
						aria-label={t('pptx.options.quickAccess.moveDown')}
						disabled={!selectedCurrent}
						onClick={() => {
							if (selectedCurrent) {
								onQuickAccessCommandsChange(
									moveQuickAccessCommand(current, selectedCurrent, 'down'),
								);
							}
						}}
						className='rounded border border-border p-1.5 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
					>
						<LuChevronDown className='h-4 w-4' />
					</button>
				</div>
			</div>
			<button
				type='button'
				onClick={onResetQuickAccess}
				className='rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent'
			>
				{t('pptx.options.quickAccess.reset')}
			</button>
		</div>
	);
}
