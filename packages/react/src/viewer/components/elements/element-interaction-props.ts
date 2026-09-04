import type { PptxElement } from 'pptx-viewer-core';
import { applyHighlightClickStyle, resolveElementHighlightClick } from 'pptx-viewer-shared';
import type React from 'react';

import type { ElementRendererProps } from './element-renderer-types';

interface ElementInteractionOptions {
	element: PptxElement;
	isEditableText: boolean;
	canInteract: boolean;
	isInlineEditing: boolean;
	isActionable: boolean;
	isPresentationPassive: boolean;
	onInlineEditCancel: () => void;
	onActionClick: ElementRendererProps['onActionClick'];
}

type ElementInteractionProps = Pick<
	React.HTMLAttributes<HTMLDivElement>,
	'onKeyDown' | 'onClick' | 'onMouseEnter' | 'onMouseLeave' | 'title'
>;

export function getElementInteractionProps({
	element,
	isEditableText,
	canInteract,
	isInlineEditing,
	isActionable,
	isPresentationPassive,
	onInlineEditCancel,
	onActionClick,
}: ElementInteractionOptions): ElementInteractionProps {
	const hasHoverAction = Boolean(element.actionHover);
	const highlight = resolveElementHighlightClick(element.actionClick, element.actionHover);
	const hoverLeaveStyle = highlight.hover?.leaveStyle;
	return {
		onKeyDown: (event) => {
			if (event.key === 'Enter' && isEditableText && canInteract && !isInlineEditing) {
				event.preventDefault();
				event.stopPropagation();
				event.currentTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			} else if (event.key === 'Escape' && isInlineEditing) {
				event.preventDefault();
				event.stopPropagation();
				onInlineEditCancel();
			} else if ((event.key === 'Enter' || event.key === ' ') && isActionable) {
				event.preventDefault();
				event.stopPropagation();
				event.currentTarget.click();
			}
		},
		onClick: (event) => {
			if (!element.actionClick || !onActionClick) {
				return;
			}
			const shouldTrigger = !canInteract || event.ctrlKey || event.metaKey;
			if (!shouldTrigger) {
				return;
			}
			event.stopPropagation();
			event.preventDefault();
			if (highlight.click) {
				const target = event.currentTarget;
				const { style, clearStyle, durationMs } = highlight.click;
				applyHighlightClickStyle(target, style);
				window.setTimeout(() => {
					applyHighlightClickStyle(target, clearStyle);
				}, durationMs);
			}
			onActionClick(element.id, element.actionClick);
		},
		onMouseEnter: (event) => {
			if (highlight.hover) {
				applyHighlightClickStyle(event.currentTarget, highlight.hover.enterStyle);
			}
			if (
				isPresentationPassive &&
				element.actionHover &&
				onActionClick &&
				(element.actionHover.url || element.actionHover.targetSlideIndex !== undefined)
			) {
				onActionClick(element.id, element.actionHover);
			}
		},
		onMouseLeave:
			hasHoverAction && hoverLeaveStyle
				? (event) => {
						applyHighlightClickStyle(event.currentTarget, hoverLeaveStyle);
					}
				: undefined,
		title:
			canInteract && element.actionClick
				? undefined
				: element.actionClick?.tooltip || element.actionHover?.tooltip || undefined,
	};
}
