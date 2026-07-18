import type { ProposalView } from 'pptx-viewer-shared/ai';
/**
 * AiProposalCard: a single staged, not-yet-applied write from the assistant.
 * Shows a short diff summary with Accept / Reject controls. Purely
 * presentational; the accept/reject callbacks route through the proposal store.
 */
import { useTranslation } from 'react-i18next';
import { LuCheck, LuX } from 'react-icons/lu';

export interface AiProposalCardProps {
	proposal: ProposalView;
	onAccept: (id: string) => void;
	onReject: (id: string) => void;
}

const MAX_SUMMARY_LINES = 4;

export function AiProposalCard({ proposal, onAccept, onReject }: AiProposalCardProps) {
	const { t } = useTranslation();
	const shown = proposal.summary.slice(0, MAX_SUMMARY_LINES);
	const extra = proposal.summary.length - shown.length;

	return (
		<div className='rounded-md border border-primary/40 bg-primary/5 p-2.5'>
			<div className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary'>
				{t('pptx.ai.proposedChange')}
			</div>
			<div className='text-[12px] font-medium text-foreground'>{proposal.label}</div>
			{shown.length > 0 && (
				<ul className='mt-1 space-y-0.5 text-[11px] text-muted-foreground'>
					{shown.map((line, i) => (
						<li key={i} className='truncate' title={line}>
							{line}
						</li>
					))}
					{extra > 0 && <li className='italic'>{t('pptx.ai.moreChanges', { count: extra })}</li>}
				</ul>
			)}
			<div className='mt-2 flex items-center gap-2'>
				<button
					type='button'
					onClick={() => onAccept(proposal.id)}
					className='inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90'
				>
					<LuCheck className='w-3.5 h-3.5' />
					{t('pptx.ai.accept')}
				</button>
				<button
					type='button'
					onClick={() => onReject(proposal.id)}
					className='inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent'
				>
					<LuX className='w-3.5 h-3.5' />
					{t('pptx.ai.reject')}
				</button>
			</div>
		</div>
	);
}
