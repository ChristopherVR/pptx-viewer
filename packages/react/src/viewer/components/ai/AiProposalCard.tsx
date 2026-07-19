import type { ProposalView } from 'pptx-viewer-shared/ai';
import { humanizeDiffLine } from 'pptx-viewer-shared/ai';
/**
 * AiProposalCard: a single staged, not-yet-applied change the assistant is
 * suggesting. Reads like a human suggestion: a clear title, a plain-language
 * description of what will happen, and friendly Apply / Discard buttons. The
 * full description is shown (never truncated); long lists scroll rather than
 * clip. The accept/reject callbacks route through the proposal store.
 */
import { useTranslation } from 'react-i18next';
import { LuCheck, LuX } from 'react-icons/lu';

export interface AiProposalCardProps {
	proposal: ProposalView;
	onAccept: (id: string) => void;
	onReject: (id: string) => void;
}

export function AiProposalCard({ proposal, onAccept, onReject }: AiProposalCardProps) {
	const { t } = useTranslation();
	const lines = proposal.summary.map(humanizeDiffLine);

	return (
		<div className='rounded-md border border-primary/40 bg-primary/5 p-2.5'>
			<div className='mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary'>
				{t('pptx.ai.proposedChange')}
			</div>
			<div className='text-[12px] font-medium text-foreground'>{proposal.label}</div>
			{lines.length > 0 && (
				<ul className='mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-muted-foreground'>
					{lines.map((line, i) => (
						<li key={i} className='break-words'>
							{line}
						</li>
					))}
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
