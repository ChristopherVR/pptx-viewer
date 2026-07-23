/**
 * AiChatPanelLazy: a `React.lazy` boundary around {@link AiChatPanel}. Importing
 * this wrapper is cheap; the real panel chunk (and its `@ai-sdk/react` +
 * `pptx-viewer-shared/ai` dependencies) is only fetched when the panel is first
 * rendered (i.e. when the user opens the assistant).
 */
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { lazy, Suspense } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';

import type { AiPanelController } from '../../hooks/ai/useAiPanelController';

const AiChatPanel = lazy(() => import('./AiChatPanel'));

export interface AiChatPanelLazyProps {
	bridge: PptxAiBridge;
	config: PptxAiConfig;
	aiPanel: AiPanelController;
	onClose: () => void;
	panelWidth?: number;
}

export function AiChatPanelLazy(props: AiChatPanelLazyProps) {
	return (
		<Suspense
			fallback={
				<div
					className='absolute right-0 top-0 z-30 flex h-full w-80 items-center justify-center border-l border-border bg-card text-muted-foreground max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[75dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:shadow-2xl'
					style={props.panelWidth ? { width: props.panelWidth } : undefined}
				>
					<LuLoaderCircle className='w-5 h-5 animate-spin' />
				</div>
			}
		>
			<AiChatPanel {...props} />
		</Suspense>
	);
}
