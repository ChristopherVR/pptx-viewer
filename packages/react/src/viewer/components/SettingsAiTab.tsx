import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import { createChatHistoryStore } from 'pptx-viewer-shared/ai';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBug, LuDownload } from 'react-icons/lu';

import type { AiLogFormat } from '../utils/ai-log-export';
import { exportAiChatLogs } from '../utils/ai-log-export';

export interface SettingsAiTabProps {
	/** Chat store to read from. Defaults to the shared `createChatHistoryStore()`. */
	store?: PptxAiChatStore;
}

type ExportState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; count: number };

/**
 * File > Options > AI: a technical section that exports the full chat history,
 * including every tool call's input/output, as a downloadable JSON or Markdown
 * log for debugging. Rendered only when the host enables the `ai` prop.
 */
export function SettingsAiTab({ store }: SettingsAiTabProps): React.ReactElement {
	const { t } = useTranslation();
	const activeStore = useMemo(() => store ?? createChatHistoryStore(), [store]);
	const [chatCount, setChatCount] = useState<number | null>(null);
	const [detailed, setDetailed] = useState(true);
	const [status, setStatus] = useState<ExportState>({ kind: 'idle' });

	useEffect(() => {
		let cancelled = false;
		const load = async (): Promise<void> => {
			try {
				const chats = await activeStore.listChats();
				if (!cancelled) {
					setChatCount(chats.length);
				}
			} catch {
				if (!cancelled) {
					setChatCount(0);
				}
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [activeStore]);

	const handleExport = useCallback(
		async (format: AiLogFormat) => {
			setStatus({ kind: 'busy' });
			try {
				const count = await exportAiChatLogs({ store: activeStore, format, detailed });
				setStatus({ kind: 'done', count });
			} catch {
				setStatus({ kind: 'done', count: 0 });
			}
		},
		[activeStore, detailed],
	);

	return (
		<div className='space-y-4'>
			<div className='flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3'>
				<LuBug className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
				<div>
					<p className='text-sm font-medium text-foreground'>{t('pptx.ai.settingsSectionTitle')}</p>
					<p className='mt-1 text-xs text-muted-foreground'>{t('pptx.ai.exportLogsHint')}</p>
				</div>
			</div>

			<p className='text-xs text-muted-foreground'>
				{chatCount === null
					? t('pptx.ai.exportLogsCounting')
					: t('pptx.ai.exportLogsStoredCount', { count: chatCount })}
			</p>

			<label className='flex items-center gap-2 text-xs text-foreground'>
				<input
					type='checkbox'
					checked={detailed}
					onChange={(e) => setDetailed(e.target.checked)}
					className='h-3.5 w-3.5 rounded border-border'
				/>
				{t('pptx.ai.exportLogsDetailed')}
			</label>

			<div className='flex flex-wrap items-center gap-2'>
				<button
					type='button'
					onClick={() => void handleExport('json')}
					disabled={status.kind === 'busy'}
					className='inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50'
				>
					<LuDownload className='h-3.5 w-3.5' />
					{t('pptx.ai.exportLogsJson')}
				</button>
				<button
					type='button'
					onClick={() => void handleExport('markdown')}
					disabled={status.kind === 'busy'}
					className='inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50'
				>
					<LuDownload className='h-3.5 w-3.5' />
					{t('pptx.ai.exportLogsMarkdown')}
				</button>
			</div>

			{status.kind === 'done' && (
				<p className='text-xs text-muted-foreground' role='status'>
					{status.count > 0
						? t('pptx.ai.exportLogsDone', { count: status.count })
						: t('pptx.ai.noChatsToExport')}
				</p>
			)}
		</div>
	);
}
