import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type {
	PptxUiRibbonTransitionsElement,
	RibbonTransitionsRequestEvent,
} from 'pptx-viewer-shared';
import {
	playSlideTransitionPreview,
	readRibbonTransitionDraft,
	ribbonTransitionsDraftPatch,
	ribbonTransitionsSoundChange,
	ribbonTransitionStockSoundUrl,
	ribbonTransitionUpdates,
} from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { playAnimationSound } from '../../utils/animation-sound';

/**
 * The Transitions ribbon tab: a thin adapter over `pptx-ui-ribbon-transitions`.
 *
 * The shared view owns every control, label, pressed state and gating. The
 * tab holds no transition state of its own: `readRibbonTransitionDraft`
 * derives what each control shows from the ACTIVE SLIDE, every change commits
 * `ribbonTransitionUpdates` through `onTransitionChange`, Preview replays the
 * slide's transition on the editing stage (and writes nothing), and sound
 * picks are raw transition patches that bypass the draft.
 */
export interface TransitionsSectionProps {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	/** The slide whose transition the tab reads and writes. */
	activeSlide?: PptxSlide;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
	canEdit?: boolean;
}

export function TransitionsSection(p: TransitionsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonTransitionsElement>(null);
	const draft = useMemo(() => readRibbonTransitionDraft(p.activeSlide), [p.activeSlide]);
	const transition = p.activeSlide?.transition;
	const editable = p.canEdit !== false;
	useEffect(() => {
		const host = ref.current;
		if (host) {
			host.state = {
				draft,
				transition,
				editable,
				inspectorOpen: p.isInspectorPaneOpen,
				translate: t,
			};
		}
	}, [draft, transition, editable, p.isInspectorPaneOpen, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			const intent = (event as RibbonTransitionsRequestEvent).detail;
			const patch = ribbonTransitionsDraftPatch(intent);
			if (patch) {
				p.onTransitionChange(ribbonTransitionUpdates({ ...draft, ...patch }));
				return;
			}
			switch (intent.kind) {
				case 'preview':
					playSlideTransitionPreview(transition, document);
					break;
				case 'applyToAll':
					p.onApplyTransitionToAll();
					break;
				case 'inspector':
					p.onToggleInspector();
					break;
				case 'soundPreview': {
					const url = ribbonTransitionStockSoundUrl(transition);
					if (url) {
						playAnimationSound(url);
					}
					break;
				}
				default:
					void ribbonTransitionsSoundChange(intent).then((change) => {
						if (change) {
							p.onTransitionChange(change);
						}
						return undefined;
					});
			}
		};
		host.addEventListener('transitions-request', request);
		return () => host.removeEventListener('transitions-request', request);
	}, [draft, transition, p]);
	return <pptx-ui-ribbon-transitions ref={ref} />;
}
