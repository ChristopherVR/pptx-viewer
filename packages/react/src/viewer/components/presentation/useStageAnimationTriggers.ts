import { PRESENTATION_ANIM_TRIGGER_ATTRIBUTE } from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';
import type { MouseEvent, RefObject } from 'react';

export interface StageAnimationTriggers {
	interactiveTriggerShapeIds: ReadonlySet<string>;
	hoverTriggerShapeIds: ReadonlySet<string>;
	handleInteractiveShapeClick: (id: string) => boolean;
	handleHoverStart: (id: string) => boolean;
	handleHoverEnd: (id: string) => void;
}

function elementId(event: MouseEvent): string | undefined {
	return event.target instanceof Element
		? event.target.closest<HTMLElement>('[data-element-id]')?.dataset.elementId
		: undefined;
}

export function useStageAnimationTriggers(
	root: RefObject<HTMLElement | null>,
	slide: unknown,
	triggers?: StageAnimationTriggers,
	onStageClick?: (event: MouseEvent) => void,
) {
	const hoverRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		root.current?.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
			const id = el.dataset.elementId ?? '';
			const trigger =
				triggers?.interactiveTriggerShapeIds.has(id) ||
				triggers?.hoverTriggerShapeIds.has(id) ||
				false;
			el.toggleAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE, trigger);
			el.style.cursor = trigger ? 'pointer' : '';
		});
		hoverRef.current = undefined;
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- a slide swap replaces stage nodes even when trigger ids are unchanged
	}, [root, slide, triggers]);

	return {
		onClick(event: MouseEvent) {
			const id = elementId(event);
			if (
				id &&
				triggers?.interactiveTriggerShapeIds.has(id) &&
				triggers.handleInteractiveShapeClick(id)
			) {
				return;
			}
			onStageClick?.(event);
		},
		onMouseOver(event: MouseEvent) {
			const id = elementId(event);
			const next = id && triggers?.hoverTriggerShapeIds.has(id) ? id : undefined;
			if (next === hoverRef.current) {
				return;
			}
			if (hoverRef.current) {
				triggers?.handleHoverEnd(hoverRef.current);
			}
			hoverRef.current = next;
			if (next) {
				triggers?.handleHoverStart(next);
			}
		},
		onMouseLeave() {
			if (hoverRef.current) {
				triggers?.handleHoverEnd(hoverRef.current);
			}
			hoverRef.current = undefined;
		},
	};
}
