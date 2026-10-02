import type {
	PresentationPointerTool,
	PresentationSnapshot,
	PptxUiPresenterConsoleElement,
	PresenterConsoleIntent,
} from 'pptx-viewer-shared';
import { presenterConsoleAction, presenterConsoleViewState } from 'pptx-viewer-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { useWebControl } from '../hooks/useWebControl';

export interface PresenterConsoleToolbarProps {
	snapshot: PresentationSnapshot;
	audienceOpen: boolean;
	onToggleAudience: () => void;
	onSwapDisplays: () => void;
	onToggleTimer: () => void;
	onResetTimer: () => void;
	onShowSlides: () => void;
	onStepZoom: (direction: 1 | -1) => void;
	onResetZoom: () => void;
	onBlackout: (value: PresentationSnapshot['blackout']) => void;
	onPointerTool: (tool: PresentationPointerTool) => void;
	onToggleSubtitles: () => void;
	onExit: () => void;
}

/**
 * PowerPoint's presenter-console strip.
 *
 * A thin adapter around the shared `pptx-ui-presenter-console`, which renders the
 * shared inventory with its accessible names, icons and pressed state. The
 * on/disabled rule (`presenterConsoleViewState`) and the meaning of each
 * activation (`presenterConsoleAction`) are shared too; this only routes the
 * resulting action to the handler props.
 */
export function PresenterConsoleToolbar(p: PresenterConsoleToolbarProps): ReactElement {
	const { t } = useTranslation();
	const ref = useWebControl<PptxUiPresenterConsoleElement>(
		{ ...presenterConsoleViewState(p.snapshot, p.audienceOpen), translate: t },
		{
			'presenter-console-request': (event) => {
				const action = presenterConsoleAction(
					(event.detail as PresenterConsoleIntent).id,
					p.snapshot,
				);
				switch (action?.kind) {
					case 'pointer':
						p.onPointerTool(action.tool);
						break;
					case 'blackout':
						p.onBlackout(action.value);
						break;
					case 'zoom':
						p.onStepZoom(action.direction);
						break;
					case 'timer-toggle':
						p.onToggleTimer();
						break;
					case 'timer-reset':
						p.onResetTimer();
						break;
					case 'all-slides':
						p.onShowSlides();
						break;
					case 'zoom-reset':
						p.onResetZoom();
						break;
					case 'captions':
						p.onToggleSubtitles();
						break;
					case 'audience':
						p.onToggleAudience();
						break;
					case 'swap-displays':
						p.onSwapDisplays();
						break;
					case 'end':
						p.onExit();
						break;
					default:
					// An id the inventory does not know: nothing to do.
				}
			},
		},
	);
	return <pptx-ui-presenter-console ref={ref} />;
}
