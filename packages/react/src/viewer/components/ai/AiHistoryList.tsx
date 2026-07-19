/**
 * AiHistoryList: the scrollable list of saved chats inside the history menu.
 * Purely presentational; each row resumes on click and exposes a delete button.
 */
import type { PptxAiChatSummary } from 'pptx-viewer-shared/ai';
import { useTranslation } from 'react-i18next';
import { LuMessageSquare, LuTrash2 } from 'react-icons/lu';

import { cn } from '../../utils';
import { relativeTime } from './ai-relative-time';

export interface AiHistoryListProps {
	chats: PptxAiChatSummary[];
	activeChatId: string;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
}

export function AiHistoryList({ chats, activeChatId, onResume, onDelete }: AiHistoryListProps) {
	const { t } = useTranslation();

	if (chats.length === 0) {
		return (
			<p className='px-3 py-4 text-center text-[12px] text-muted-foreground'>
				{t('pptx.ai.historyEmpty')}
			</p>
		);
	}

	return (
		<ul className='max-h-64 overflow-y-auto py-1'>
			{chats.map((chat) => (
				<li key={chat.id} className='group flex items-center gap-1 px-1'>
					<button
						type='button'
						onClick={() => onResume(chat.id)}
						className={cn(
							'flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent',
							chat.id === activeChatId && 'bg-accent/60',
						)}
					>
						<LuMessageSquare className='mt-0.5 w-3.5 h-3.5 shrink-0 text-muted-foreground' />
						<span className='min-w-0 flex-1'>
							<span className='block truncate text-[12px] font-medium text-foreground'>
								{chat.title || t('pptx.ai.untitledChat')}
							</span>
							<span className='block text-[10px] text-muted-foreground'>
								{relativeTime(chat.updatedAt)} ·{' '}
								{t('pptx.ai.messageCount', { count: chat.messageCount })}
							</span>
						</span>
					</button>
					<button
						type='button'
						onClick={() => onDelete(chat.id)}
						title={t('pptx.ai.deleteChat')}
						aria-label={t('pptx.ai.deleteChat')}
						className='shrink-0 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100'
					>
						<LuTrash2 className='w-3.5 h-3.5' />
					</button>
				</li>
			))}
		</ul>
	);
}
