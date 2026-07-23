/**
 * AiChatPanel: the right-hand AI assistant pane. Default-exported so it can be
 * `React.lazy`-loaded (its `@ai-sdk/react` + `pptx-viewer-shared/ai` runtime
 * imports only load when the panel is first opened).
 *
 * The panel is a thin shell: it builds/guards the session via {@link useAiChat}
 * and, once ready, delegates the whole conversation to {@link AiConversation}.
 */
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLoaderCircle, LuSparkles, LuTriangleAlert, LuX } from 'react-icons/lu';

import { deckIdFromBridge } from '../../hooks/ai/ai-deck-id';
import { useAiChat } from '../../hooks/ai/useAiChat';
import type { AiPanelController } from '../../hooks/ai/useAiPanelController';
import { AiConversation } from './AiConversation';

export interface AiChatPanelProps {
	bridge: PptxAiBridge;
	config: PptxAiConfig;
	aiPanel: AiPanelController;
	onClose: () => void;
	panelWidth?: number;
}

export default function AiChatPanel({
	bridge,
	config,
	aiPanel,
	onClose,
	panelWidth,
}: AiChatPanelProps) {
	const { t } = useTranslation();
	const { state, session, initError } = useAiChat(bridge, config);
	const deckId = useMemo(() => deckIdFromBridge(bridge), [bridge]);

	return (
		<div
			data-pptx-ai-panel=''
			// Desktop: right-edge side panel. Mobile (max-md): a bottom sheet, not a
			// full-screen overlay - a full-height panel covered the whole canvas so
			// AI-created/selected elements could not be tapped ("breaks the clicking
			// flow"). Matches the app's other mobile panels (theme editor etc.), so
			// the top of the canvas stays visible and interactive above the sheet.
			className='absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-card shadow-xl max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[75dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:shadow-2xl'
			style={panelWidth ? { width: panelWidth } : undefined}
		>
			<div className='flex items-center gap-2 border-b border-border px-3 py-2'>
				<LuSparkles className='w-4 h-4 text-primary' />
				<span className='text-sm font-semibold text-foreground'>{t('pptx.ai.title')}</span>
				<button
					type='button'
					onClick={onClose}
					title={t('pptx.ai.close')}
					aria-label={t('pptx.ai.close')}
					className='ml-auto rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent'
				>
					<LuX className='w-4 h-4' />
				</button>
			</div>

			{state === 'checking' && (
				<div className='flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground'>
					<LuLoaderCircle className='w-5 h-5 animate-spin' />
				</div>
			)}

			{(state === 'unavailable' || state === 'error') && (
				<div className='flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center'>
					<LuTriangleAlert className='w-6 h-6 text-muted-foreground' />
					<p className='text-sm font-medium text-foreground'>{t('pptx.ai.unavailableTitle')}</p>
					<p className='text-[12px] text-muted-foreground'>
						{initError?.message ?? t('pptx.ai.unavailableHint')}
					</p>
				</div>
			)}

			{state === 'ready' && session && (
				<AiConversation
					session={session}
					config={config}
					bridge={bridge}
					aiPanel={aiPanel}
					deckId={deckId}
				/>
			)}
		</div>
	);
}
