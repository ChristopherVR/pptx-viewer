import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { playAnimationRibbonPreview } from 'pptx-viewer-shared';
import type {
	AnimationApplyGroup,
	PptxUiRibbonAnimationsElement,
	RibbonAnimationsRequestEvent,
} from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface AnimationsSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** The slide holding `selectedElement`; animations are stored per-slide, keyed by elementId. */
	activeSlide?: Pick<PptxSlide, 'animations'>;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	onOpenAnimationPanel?: () => void;
	onAddAnimation?: (preset: string, group: AnimationApplyGroup) => void;
	onRemoveAnimation?: () => void;
}

/**
 * Animations tab adapter. Effects, motion paths and their galleries render in
 * the shared `pptx-ui-ribbon-animations` view; the slide model, selection,
 * preview playback and inspector lifecycle stay native to this binding.
 */
export function AnimationsSection(p: AnimationsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonAnimationsElement>(null);
	const [previewActive, setPreviewActive] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const disabled = !p.canEdit || p.selectedElement === null;
	const selectedAnimation = useMemo(
		() =>
			p.selectedElement
				? (p.activeSlide?.animations ?? []).find((a) => a.elementId === p.selectedElement?.id)
				: undefined,
		[p.activeSlide?.animations, p.selectedElement],
	);
	useEffect(() => () => clearTimeout(timer.current), []);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			editable: p.canEdit,
			hasSelection: p.selectedElement !== null,
			paneOpen: p.isInspectorPaneOpen,
			previewActive,
			translate: t,
		};
	}, [p.canEdit, p.selectedElement, p.isInspectorPaneOpen, previewActive, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			const intent = (event as RibbonAnimationsRequestEvent).detail;
			if (intent.kind === 'add') {
				p.onAddAnimation?.(intent.preset, intent.group);
			} else if (intent.value === 'remove') {
				p.onRemoveAnimation?.();
			} else if (intent.value === 'preview') {
				if (disabled) {
					return;
				}
				// Highlights the button AND plays the selected element's own authored
				// effect in place on the canvas.
				setPreviewActive(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setPreviewActive(false), 1200);
				playAnimationRibbonPreview(document, selectedAnimation);
			} else {
				(p.onOpenAnimationPanel ?? p.onToggleInspector)();
			}
		};
		host.addEventListener('animations-request', request);
		return () => host.removeEventListener('animations-request', request);
	}, [p, disabled, selectedAnimation]);
	return <pptx-ui-ribbon-animations ref={ref} />;
}
