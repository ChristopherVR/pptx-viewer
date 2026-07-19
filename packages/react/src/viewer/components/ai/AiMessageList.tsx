/**
 * AiMessageList: scrollable transcript of user / assistant turns. Assistant
 * tool calls render as {@link AiToolCallCard}s inline between prose. Purely
 * presentational; auto-scrolls to the newest message.
 */
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBot, LuSparkles, LuUser } from 'react-icons/lu';

import { cn } from '../../utils';
import type { AiUiMessage } from './ai-message-parts';
import { toRenderableParts } from './ai-message-parts';
import { appliedThemeFromPart } from './ai-theme-result';
import { AiAppliedThemeCard } from './AiAppliedThemeCard';
import { AiToolCallCard } from './AiToolCallCard';

export interface AiMessageListProps {
	messages: AiUiMessage[];
	isStreaming: boolean;
	/** Bridge, used to Undo an applied theme edit from its confirmation card. */
	bridge: PptxAiBridge;
}

export function AiMessageList({ messages, isStreaming, bridge }: AiMessageListProps) {
	const { t } = useTranslation();
	const endRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: 'end' });
	}, [messages, isStreaming]);

	if (messages.length === 0) {
		return (
			<div className='flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center'>
				<LuSparkles className='w-7 h-7 text-primary/70' />
				<p className='text-sm font-medium text-foreground'>{t('pptx.ai.emptyTitle')}</p>
				<p className='text-[12px] text-muted-foreground'>{t('pptx.ai.emptyHint')}</p>
			</div>
		);
	}

	return (
		<div className='flex-1 space-y-3 overflow-y-auto px-3 py-3'>
			{messages.map((message) => {
				const isUser = message.role === 'user';
				const parts = toRenderableParts(message);
				if (parts.length === 0 && !isUser) {
					return null;
				}
				return (
					<div key={message.id} className='flex gap-2'>
						<div
							className={cn(
								'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
								isUser ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary',
							)}
							aria-label={isUser ? t('pptx.ai.you') : t('pptx.ai.assistant')}
						>
							{isUser ? <LuUser className='w-3.5 h-3.5' /> : <LuBot className='w-3.5 h-3.5' />}
						</div>
						<div className='min-w-0 flex-1 space-y-1.5'>
							{parts.map((part, i) => {
								if (part.kind === 'text') {
									return (
										<p
											key={i}
											className='whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground'
										>
											{part.text}
										</p>
									);
								}
								const applied = appliedThemeFromPart(part);
								if (applied) {
									return (
										<AiAppliedThemeCard
											key={part.toolCallId || i}
											summary={applied.summary}
											onUndo={() => bridge.applyTheme(applied.previous)}
										/>
									);
								}
								return <AiToolCallCard key={part.toolCallId || i} part={part} />;
							})}
						</div>
					</div>
				);
			})}
			{isStreaming && (
				<div className='flex items-center gap-2 pl-8 text-[12px] text-muted-foreground'>
					<span className='inline-flex gap-1'>
						<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]' />
						<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]' />
						<span className='h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground' />
					</span>
					{t('pptx.ai.thinking')}
				</div>
			)}
			<div ref={endRef} />
		</div>
	);
}
