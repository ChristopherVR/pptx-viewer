import { buildTitleBarState, isPanelVisible, resolveScreenTip } from 'pptx-viewer-shared';
import type {
	PptxUiTitleBarElement,
	TitleBarCommandSearchEvent,
	TitleBarHostInput,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useViewerCustomizationContext } from '../viewer-customization-context';
import { useViewerOptionsContext } from '../viewer-options-context';

export type TitleBarElementInput = Omit<
	TitleBarHostInput,
	'translate' | 'quickAccess' | 'screenTip' | 'commands' | 'contentSearch'
>;

export interface TitleBarElementHandlers {
	onToggleAutosave?: () => void;
	onSave?: () => void;
	onUndo?: () => void;
	onRedo?: () => void;
	onQuickCommand?: (id: string) => void;
	onCommandSearch?: (command: string) => void;
	onToggleFindReplace?: () => void;
}

export interface TitleBarElementProps extends TitleBarElementHandlers {
	placement?: 'titleBar' | 'belowRibbon';
	input: TitleBarElementInput;
	children?: React.ReactNode;
}

/**
 * Thin adapter around the shared `pptx-ui-title-bar`. Maps viewer state to the
 * element's controlled state and routes its typed events to the host callbacks.
 */
export function TitleBarElement(p: TitleBarElementProps): React.ReactElement {
	const { t } = useTranslation();
	const options = useViewerOptionsContext();
	const customization = useViewerCustomizationContext();
	const ref = useRef<PptxUiTitleBarElement>(null);
	const stripVisible =
		options.quickAccess.visible && isPanelVisible(customization, 'quickAccessToolbar');
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = buildTitleBarState({
			...p.input,
			quickAccess: { ...options.quickAccess, visible: stripVisible },
			screenTip: (label) => resolveScreenTip(options, label),
			translate: t,
		});
	}, [p.input, options, stripVisible, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const on = (name: string, run: (event: Event) => void) => {
			host.addEventListener(name, run);
			return () => host.removeEventListener(name, run);
		};
		const offs = [
			on('toggle-autosave', () => p.onToggleAutosave?.()),
			on('save', () => p.onSave?.()),
			on('undo', () => p.onUndo?.()),
			on('redo', () => p.onRedo?.()),
			on('quick-command', (event) =>
				p.onQuickCommand?.((event as CustomEvent<{ id: string }>).detail.id),
			),
			on('command-search', (event) => {
				const { command } = (event as TitleBarCommandSearchEvent).detail;
				if (command) {
					p.onCommandSearch?.(command);
				} else {
					p.onToggleFindReplace?.();
				}
			}),
		];
		return () => offs.forEach((off) => off());
	}, [p]);
	return (
		<pptx-ui-title-bar
			ref={ref}
			placement={p.placement === 'belowRibbon' ? 'belowRibbon' : undefined}
		>
			{p.children}
		</pptx-ui-title-bar>
	);
}
