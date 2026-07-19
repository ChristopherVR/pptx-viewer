/**
 * AiFocusBar: the strip under the panel header showing the assistant's current
 * focused targets as chips (live from the canvas selection, pinned, or picked).
 *
 * It also hosts the explicit "Point at a slide element" affordance: a crosshair
 * button that enters PICK MODE, after which the user clicks element(s) on the
 * canvas to hand them to the assistant (each pick is highlighted on the slide).
 * A one-click "Merge selected tables" directive still surfaces when the focus is
 * exactly two tables.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { useTranslation } from 'react-i18next';
import { LuCrosshair, LuGitMerge, LuPin, LuPinOff, LuX } from 'react-icons/lu';

import { focusTargetChips, isTwoTableFocus } from '../../hooks/ai/focus-targets';
import { cn } from '../../utils';

export interface AiFocusBarProps {
	targets: PptxAiFocusedTarget[];
	slides: PptxSlide[];
	isPinned: boolean;
	onPin: () => void;
	onClearPin: () => void;
	onSendDirective: (text: string) => void;
	/** True while the user is picking element(s) on the canvas. */
	pickMode: boolean;
	/** True when there are explicit picks (drives the Clear control). */
	hasPicks: boolean;
	onStartPick: () => void;
	onStopPick: () => void;
	onClearPicks: () => void;
}

/** Build the directive that fires `merge_tables` without a confirmation round-trip. */
function mergeDirective(slideIndex: number, elementIdA: string, elementIdB: string): string {
	return (
		`Merge the two selected tables (elementIdA=${elementIdA}, elementIdB=${elementIdB}) ` +
		`on slide ${slideIndex + 1} using merge_tables; stage it now, do not ask me to confirm.`
	);
}

export function AiFocusBar({
	targets,
	slides,
	isPinned,
	onPin,
	onClearPin,
	onSendDirective,
	pickMode,
	hasPicks,
	onStartPick,
	onStopPick,
	onClearPicks,
}: AiFocusBarProps) {
	const { t } = useTranslation();
	const chips = focusTargetChips(targets, slides);
	const twoTables = isTwoTableFocus(targets, slides);

	return (
		<div className='border-b border-border bg-secondary/30'>
			<div className='flex flex-wrap items-center gap-1 px-2.5 py-1.5'>
				<span className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
					{t('pptx.ai.focusScope')}
				</span>
				{chips.map((chip) => (
					<span
						key={chip.key}
						className={cn(
							'inline-flex max-w-[10rem] items-center rounded-full px-2 py-0.5 text-[11px]',
							hasPicks || isPinned
								? 'bg-primary/15 text-primary'
								: 'bg-muted text-muted-foreground',
						)}
						title={chip.title}
					>
						<span className='truncate'>{chip.label}</span>
					</span>
				))}
				{isPinned && (
					<span className='rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary'>
						{t('pptx.ai.pinnedFocus')}
					</span>
				)}
				<div className='ml-auto flex items-center gap-0.5'>
					{twoTables && (
						<button
							type='button'
							onClick={() =>
								onSendDirective(
									mergeDirective(twoTables.slideIndex, twoTables.elementIdA, twoTables.elementIdB),
								)
							}
							className='inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary'
						>
							<LuGitMerge className='w-3 h-3' />
							{t('pptx.ai.mergeSelectedTables')}
						</button>
					)}
					<button
						type='button'
						onClick={pickMode ? onStopPick : onStartPick}
						title={t('pptx.ai.pickElement')}
						aria-label={t('pptx.ai.pickAria')}
						aria-pressed={pickMode}
						className={cn(
							'rounded-sm p-1',
							pickMode
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent',
						)}
					>
						<LuCrosshair className='w-3.5 h-3.5' />
					</button>
					{hasPicks && (
						<button
							type='button'
							onClick={onClearPicks}
							title={t('pptx.ai.pickClear')}
							aria-label={t('pptx.ai.pickClear')}
							className='rounded-sm p-1 text-muted-foreground hover:bg-accent'
						>
							<LuX className='w-3.5 h-3.5' />
						</button>
					)}
					{!hasPicks && (
						<button
							type='button'
							onClick={isPinned ? onClearPin : onPin}
							title={isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')}
							aria-label={isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')}
							className='rounded-sm p-1 text-muted-foreground hover:bg-accent'
						>
							{isPinned ? <LuPinOff className='w-3.5 h-3.5' /> : <LuPin className='w-3.5 h-3.5' />}
						</button>
					)}
				</div>
			</div>
			{pickMode && (
				<div className='flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-2.5 py-1'>
					<LuCrosshair className='w-3.5 h-3.5 shrink-0 animate-pulse text-primary' />
					<span className='text-[11px] font-medium text-primary'>
						{t('pptx.ai.pickElementHint')}
					</span>
					<button
						type='button'
						onClick={onStopPick}
						className='ml-auto rounded-sm bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90'
					>
						{t('pptx.ai.pickDone')}
					</button>
				</div>
			)}
		</div>
	);
}
