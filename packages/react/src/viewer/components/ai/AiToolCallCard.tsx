/**
 * AiToolCallCard: a subtle, non-technical "activity" row describing one thing
 * the assistant did, e.g. "Looked at slide 5" / "Merged two tables", with a
 * friendly icon and a status (working / done / failed). The raw tool name +
 * arguments are hidden behind an optional, collapsed "Details" disclosure for
 * power users. Purely presentational.
 */
import type { ToolActivityIcon } from 'pptx-viewer-shared/ai';
import { describeToolActivity, summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuChartColumn,
	LuCheck,
	LuEye,
	LuFilm,
	LuLayoutTemplate,
	LuLoaderCircle,
	LuMove,
	LuNavigation,
	LuPalette,
	LuSearch,
	LuShapes,
	LuStickyNote,
	LuTable,
	LuTrash2,
	LuTriangleAlert,
	LuType,
	LuWrench,
} from 'react-icons/lu';

import { cn } from '../../utils';
import type { RenderableToolPart } from './ai-message-parts';

export interface AiToolCallCardProps {
	part: RenderableToolPart;
}

/** Map a shared icon category to a concrete lucide glyph. */
const ICONS: Record<ToolActivityIcon, ComponentType<{ className?: string }>> = {
	view: LuEye,
	text: LuType,
	shape: LuShapes,
	theme: LuPalette,
	table: LuTable,
	slide: LuLayoutTemplate,
	chart: LuChartColumn,
	move: LuMove,
	delete: LuTrash2,
	search: LuSearch,
	nav: LuNavigation,
	animation: LuFilm,
	notes: LuStickyNote,
	tool: LuWrench,
};

export function AiToolCallCard({ part }: AiToolCallCardProps) {
	const { t } = useTranslation();
	const failed = part.state === 'output-error';
	const done = part.state === 'output-available';
	const running = !failed && !done;

	const activity = describeToolActivity(part.toolName, part.input, running ? 'present' : 'past');
	const Icon = ICONS[activity.icon] ?? LuWrench;
	const rawSummary = summarizeToolArgs(part.input);

	const statusLabel = failed
		? t('pptx.ai.toolFailed')
		: done
			? t('pptx.ai.toolDone')
			: t('pptx.ai.toolRunning');

	return (
		<div className='text-[12px]'>
			<div className='flex items-center gap-1.5'>
				<Icon
					className={cn(
						'w-3.5 h-3.5 shrink-0',
						failed ? 'text-destructive' : 'text-muted-foreground',
					)}
				/>
				<span className={cn('truncate', failed ? 'text-destructive' : 'text-foreground')}>
					{activity.label}
				</span>
				<span
					className={cn(
						'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]',
						failed
							? 'bg-destructive/15 text-destructive'
							: done
								? 'bg-primary/10 text-primary'
								: 'bg-muted text-muted-foreground',
					)}
				>
					{running && <LuLoaderCircle className='w-3 h-3 animate-spin' />}
					{done && <LuCheck className='w-3 h-3' />}
					{failed && <LuTriangleAlert className='w-3 h-3' />}
					{statusLabel}
				</span>
			</div>
			{failed && part.errorText && (
				<div className='mt-1 pl-5 text-[11px] text-destructive'>{part.errorText}</div>
			)}
			{rawSummary && (
				<details className='group mt-0.5 pl-5'>
					<summary className='cursor-pointer list-none text-[10px] text-muted-foreground/70 hover:text-muted-foreground'>
						{t('pptx.ai.toolDetails')}
					</summary>
					<div className='mt-0.5 break-words font-mono text-[10px] text-muted-foreground/80'>
						{toolLabel(part.toolName)}: {rawSummary}
					</div>
				</details>
			)}
		</div>
	);
}
