/**
 * AiConversation: the "ready" body of the AI panel. Wires the live session to
 * `useChat` (via {@link useAiConversation}) and lays out the transcript, the
 * staged-proposal review strip, an error banner, and the composer.
 */
import type { PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useTranslation } from 'react-i18next';
import { LuTriangleAlert } from 'react-icons/lu';

import { useAiConversation } from '../../hooks/ai/useAiConversation';
import { AiComposer } from './AiComposer';
import { AiMessageList } from './AiMessageList';
import { AiProposalCard } from './AiProposalCard';

export interface AiConversationProps {
	session: PptxAiChatSession;
	config: PptxAiConfig;
}

export function AiConversation({ session, config }: AiConversationProps) {
	const { t } = useTranslation();
	const chat = useAiConversation(session, config);

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<AiMessageList messages={chat.messages} isStreaming={chat.isStreaming} />

			{chat.error && (
				<div className='mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive'>
					<LuTriangleAlert className='mt-0.5 w-3.5 h-3.5 shrink-0' />
					<div className='min-w-0 flex-1'>
						<div className='font-medium'>{t('pptx.ai.errorPrefix')}</div>
						<div className='truncate text-[11px] opacity-80' title={chat.error.message}>
							{chat.error.message}
						</div>
					</div>
					<button
						type='button'
						onClick={chat.clearError}
						className='shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] underline-offset-2 hover:underline'
					>
						{t('pptx.ai.retry')}
					</button>
				</div>
			)}

			{chat.proposals.length > 0 && (
				<div className='max-h-[38%] space-y-2 overflow-y-auto border-t border-border bg-background px-3 py-2'>
					<div className='flex items-center justify-between'>
						<span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
							{t('pptx.ai.pendingChanges', { count: chat.proposals.length })}
						</span>
						{chat.proposals.length > 1 && (
							<button
								type='button'
								onClick={chat.acceptAllProposals}
								className='rounded-sm bg-primary/90 px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary'
							>
								{t('pptx.ai.acceptAll')}
							</button>
						)}
					</div>
					{chat.proposals.map((proposal) => (
						<AiProposalCard
							key={proposal.id}
							proposal={proposal}
							onAccept={chat.applyProposal}
							onReject={chat.rejectProposal}
						/>
					))}
				</div>
			)}

			<AiComposer isStreaming={chat.isStreaming} onSend={chat.send} onStop={chat.stop} />
		</div>
	);
}
