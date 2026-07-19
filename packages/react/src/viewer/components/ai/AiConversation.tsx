/**
 * AiConversation: the "ready" body of the AI panel. Wires the live session to
 * `useChat` (via {@link useAiConversation}), persists the transcript through
 * {@link useAiHistory}, and lays out the chat toolbar (chats / new / clear), the
 * focused-target bar, the transcript, the staged-proposal review strip, an error
 * banner, and the composer.
 */
import type { PptxAiBridge, PptxAiChatSession, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuHistory, LuMessageSquarePlus, LuTrash2, LuTriangleAlert } from 'react-icons/lu';

import { useAiConversation } from '../../hooks/ai/useAiConversation';
import { useAiHistory } from '../../hooks/ai/useAiHistory';
import type { AiPanelController } from '../../hooks/ai/useAiPanelController';
import { AiComposer } from './AiComposer';
import { AiFocusBar } from './AiFocusBar';
import { AiHistoryMenu } from './AiHistoryMenu';
import { AiMessageList } from './AiMessageList';
import { AiProposalCard } from './AiProposalCard';

export interface AiConversationProps {
	session: PptxAiChatSession;
	config: PptxAiConfig;
	bridge: PptxAiBridge;
	aiPanel: AiPanelController;
	deckId: string;
}

export function AiConversation({ session, config, bridge, aiPanel, deckId }: AiConversationProps) {
	const { t } = useTranslation();
	const chat = useAiConversation(session, config, bridge);
	const history = useAiHistory({
		deckId,
		messages: chat.messages,
		setMessages: chat.setMessages,
	});
	const [historyOpen, setHistoryOpen] = useState(false);

	const effectiveTargets = aiPanel.pinnedFocus ?? aiPanel.liveFocusTargets;
	const isPinned = aiPanel.pinnedFocus !== null;

	return (
		<div className='relative flex min-h-0 flex-1 flex-col'>
			<div className='flex items-center gap-1 border-b border-border px-2 py-1'>
				<button
					type='button'
					onClick={() => setHistoryOpen((p) => !p)}
					className='inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[12px] text-muted-foreground hover:bg-accent'
				>
					<LuHistory className='w-3.5 h-3.5' />
					{t('pptx.ai.chats')}
				</button>
				<div className='ml-auto flex items-center gap-0.5'>
					<button
						type='button'
						onClick={history.newChat}
						title={t('pptx.ai.newChat')}
						aria-label={t('pptx.ai.newChat')}
						className='rounded-sm p-1 text-muted-foreground hover:bg-accent'
					>
						<LuMessageSquarePlus className='w-3.5 h-3.5' />
					</button>
					<button
						type='button'
						onClick={history.clearCurrent}
						title={t('pptx.ai.clearChat')}
						aria-label={t('pptx.ai.clearChat')}
						disabled={chat.messages.length === 0}
						className='rounded-sm p-1 text-muted-foreground hover:bg-accent disabled:opacity-40'
					>
						<LuTrash2 className='w-3.5 h-3.5' />
					</button>
				</div>
			</div>

			{historyOpen && (
				<AiHistoryMenu
					chats={history.chats}
					activeChatId={history.activeChatId}
					onResume={(id) => void history.resumeChat(id)}
					onDelete={(id) => void history.deleteChat(id)}
					onNewChat={history.newChat}
					onClose={() => setHistoryOpen(false)}
				/>
			)}

			<AiFocusBar
				targets={effectiveTargets}
				slides={bridge.getSlides()}
				isPinned={isPinned}
				onPin={aiPanel.pinFocus}
				onClearPin={aiPanel.clearPinnedFocus}
				onSendDirective={chat.send}
			/>

			<AiMessageList messages={chat.messages} isStreaming={chat.isStreaming} bridge={bridge} />

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

			<AiComposer
				isStreaming={chat.isStreaming}
				onSend={chat.send}
				onStop={chat.stop}
				prefillText={aiPanel.prefill.text}
				prefillNonce={aiPanel.prefill.nonce}
			/>
		</div>
	);
}
