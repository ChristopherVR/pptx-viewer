/**
 * AiToolCallCard: a compact card describing one tool the assistant invoked,
 * with a human summary of its arguments and a state chip (running / done /
 * failed). Purely presentational.
 */
import { useTranslation } from 'react-i18next';
import { LuCheck, LuLoaderCircle, LuTriangleAlert, LuWrench } from 'react-icons/lu';

import { cn } from '../../utils';
import type { RenderableToolPart } from './ai-message-parts';
import { summarizeToolArgs, toolLabel } from './ai-tool-summary';

export interface AiToolCallCardProps {
	part: RenderableToolPart;
}

export function AiToolCallCard({ part }: AiToolCallCardProps) {
	const { t } = useTranslation();
	const failed = part.state === 'output-error';
	const done = part.state === 'output-available';
	const running = !failed && !done;
	const summary = summarizeToolArgs(part.input);

	const statusLabel = failed
		? t('pptx.ai.toolFailed')
		: done
			? t('pptx.ai.toolDone')
			: t('pptx.ai.toolRunning');

	return (
		<div
			className={cn(
				'rounded-md border px-2.5 py-1.5 text-[12px]',
				failed ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-secondary/40',
			)}
		>
			<div className='flex items-center gap-1.5'>
				<LuWrench className='w-3.5 h-3.5 shrink-0 text-muted-foreground' />
				<span className='font-medium text-foreground'>{toolLabel(part.toolName)}</span>
				<span
					className={cn(
						'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]',
						failed
							? 'bg-destructive/15 text-destructive'
							: done
								? 'bg-primary/15 text-primary'
								: 'bg-muted text-muted-foreground',
					)}
				>
					{running && <LuLoaderCircle className='w-3 h-3 animate-spin' />}
					{done && <LuCheck className='w-3 h-3' />}
					{failed && <LuTriangleAlert className='w-3 h-3' />}
					{statusLabel}
				</span>
			</div>
			{summary && (
				<div className='mt-1 truncate font-mono text-[11px] text-muted-foreground' title={summary}>
					{summary}
				</div>
			)}
			{failed && part.errorText && (
				<div className='mt-1 text-[11px] text-destructive'>{part.errorText}</div>
			)}
		</div>
	);
}
