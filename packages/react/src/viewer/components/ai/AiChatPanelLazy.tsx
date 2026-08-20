/**
 * AiChatPanelLazy: a `React.lazy` boundary around {@link AiChatPanel}. Importing
 * this wrapper is cheap; the real panel chunk (and its `@ai-sdk/react` +
 * `pptx-viewer-shared/ai` dependencies) is only fetched when the panel is first
 * rendered (i.e. when the user opens the assistant).
 *
 * `@ai-sdk/react` is resolved with a runtime `import()` HERE, inside the lazy
 * factory, rather than as a static import in the panel chunk itself.
 * `@ai-sdk/react` is an optional peer, so a consumer who has not installed it
 * gets an empty stub module from their bundler's optional-peer handling; a
 * static `import { useChat } from '@ai-sdk/react'` anywhere in the reachable
 * module graph asks Rollup to validate that named binding at link time, which
 * fails the CONSUMER's production build outright (`"useChat" is not
 * exported`) even though the AI panel is only reached once the user opens it.
 * Resolving it with `import()` alongside the panel chunk, then threading the
 * resolved function down as a prop, defers that lookup to runtime instead (see
 * issue #143, fixed the same way for `pptx-svelte-viewer`).
 */
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { lazy, Suspense } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';

import type { AiPanelController } from '../../hooks/ai/useAiPanelController';
import type { AiChatPanelProps } from './AiChatPanel';

const AiChatPanel = lazy(async () => {
	const [{ useChat }, { default: Panel }] = await Promise.all([
		import('@ai-sdk/react'),
		import('./AiChatPanel'),
	]);
	// `useChat` is threaded through as a value, not called here, by design: it is
	// resolved once per lazy-loaded chunk (see the module comment above) and
	// handed to `Panel`, which is the component that actually calls it.
	function BoundAiChatPanel(props: Omit<AiChatPanelProps, 'useChat'>) {
		// oxlint-disable-next-line react/hooks -- see comment above
		return <Panel {...props} useChat={useChat} />;
	}
	return { default: BoundAiChatPanel };
});

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
