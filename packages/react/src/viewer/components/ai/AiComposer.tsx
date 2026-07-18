/**
 * AiComposer: the message input row (auto-growing textarea + send / stop
 * button). Enter sends, Shift+Enter inserts a newline. Purely presentational.
 */
import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSend, LuSquare } from 'react-icons/lu';

import { cn } from '../../utils';

export interface AiComposerProps {
	isStreaming: boolean;
	onSend: (text: string) => void;
	onStop: () => void;
}

export function AiComposer({ isStreaming, onSend, onStop }: AiComposerProps) {
	const { t } = useTranslation();
	const [value, setValue] = useState('');

	const submit = useCallback(() => {
		const trimmed = value.trim();
		if (trimmed.length === 0 || isStreaming) {
			return;
		}
		onSend(trimmed);
		setValue('');
	}, [value, isStreaming, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				submit();
			}
		},
		[submit],
	);

	return (
		<div className='border-t border-border p-2'>
			<div className='flex items-end gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-ring'>
				<textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					rows={1}
					placeholder={t('pptx.ai.placeholder')}
					aria-label={t('pptx.ai.placeholder')}
					className='max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground'
				/>
				{isStreaming ? (
					<button
						type='button'
						onClick={onStop}
						title={t('pptx.ai.stop')}
						aria-label={t('pptx.ai.stop')}
						className='shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent'
					>
						<LuSquare className='w-4 h-4' />
					</button>
				) : (
					<button
						type='button'
						onClick={submit}
						disabled={value.trim().length === 0}
						title={t('pptx.ai.send')}
						aria-label={t('pptx.ai.send')}
						className={cn(
							'shrink-0 rounded-sm p-1.5 transition-colors',
							value.trim().length === 0
								? 'text-muted-foreground/50'
								: 'bg-primary text-primary-foreground hover:bg-primary/90',
						)}
					>
						<LuSend className='w-4 h-4' />
					</button>
				)}
			</div>
		</div>
	);
}
