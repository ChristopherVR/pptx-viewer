import type { PptxElement } from 'pptx-viewer-core';
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
			if (element.actionClick.highlightClick) {
				const target = event.currentTarget;
				target.style.filter = 'brightness(1.18)';
				target.style.outline = '2px solid rgba(59, 130, 246, 0.6)';
				window.setTimeout(() => {
					target.style.filter = '';
					target.style.outline = '';
				}, 320);
			}
			onActionClick(element.id, element.actionClick);
		},
		onMouseEnter: (event) => {
			if (element.actionHover?.highlightClick) {
				const target = event.currentTarget;
				target.style.filter = 'brightness(1.15)';
				target.style.outline = '2px solid rgba(59, 130, 246, 0.5)';
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
			hasHoverAction && element.actionHover?.highlightClick
				? (event) => {
						event.currentTarget.style.filter = '';
						event.currentTarget.style.outline = '';
					}
				: undefined,
		title:
			canInteract && element.actionClick
				? undefined
				: element.actionClick?.tooltip || element.actionHover?.tooltip || undefined,
	};
}
