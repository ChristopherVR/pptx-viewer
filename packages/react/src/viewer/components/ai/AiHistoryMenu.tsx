/**
 * AiHistoryMenu: the dropdown opened from the panel header's "Chats" button. It
 * lists saved chats (newest first), offers "New chat", and a caption making
 * clear that history lives in this browser. Thin: the list is
 * {@link AiHistoryList}, all persistence lives in `useAiHistory`.
 */
import type { PptxAiChatSummary } from 'pptx-viewer-shared/ai';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus } from 'react-icons/lu';

import { AiHistoryList } from './AiHistoryList';

export interface AiHistoryMenuProps {
	chats: PptxAiChatSummary[];
	activeChatId: string;
	onResume: (id: string) => void;
	onDelete: (id: string) => void;
	onNewChat: () => void;
	onClose: () => void;
}

export function AiHistoryMenu({
	chats,
	activeChatId,
	onResume,
	onDelete,
	onNewChat,
	onClose,
}: AiHistoryMenuProps) {
	const { t } = useTranslation();
	const ref = useRef<HTMLDivElement | null>(null);

	// Close on outside click.
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [onClose]);

	return (
		<div
			ref={ref}
			className='absolute right-2 top-10 z-40 w-64 rounded-md border border-border bg-popover shadow-xl'
		>
			<div className='flex items-center justify-between border-b border-border px-2.5 py-1.5'>
				<span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
					{t('pptx.ai.historyTitle')}
				</span>
				<button
					type='button'
					onClick={() => {
						onNewChat();
						onClose();
					}}
					className='inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary'
				>
					<LuPlus className='w-3 h-3' />
					{t('pptx.ai.newChat')}
				</button>
			</div>
			<AiHistoryList
				chats={chats}
				activeChatId={activeChatId}
				onResume={(id) => {
					onResume(id);
					onClose();
				}}
				onDelete={onDelete}
			/>
			<p className='border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground'>
				{t('pptx.ai.historyHint')}
			</p>
		</div>
	);
}
