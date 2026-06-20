/**
 * RemoteSelectionOverlay: Renders colored outlines around elements that
 * remote collaborators have selected, with a small name label.
 *
 * Similar to Google Slides / PowerPoint Online collaboration indicators.
 *
 * @module collaboration/RemoteSelectionOverlay
 */
import type { PptxElement } from 'pptx-viewer-core';
import React from 'react';

import { useCollaboration } from './CollaborationProvider';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RemoteSelectionOverlayProps {
	/** Elements on the active slide (used to look up position/size). */
	elements: PptxElement[];
	/** The current slide index; only show selections on the same slide. */
	activeSlideIndex: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RemoteSelectionOverlay({
	elements,
	activeSlideIndex,
}: RemoteSelectionOverlayProps): React.ReactElement | null {
	const collab = useCollaboration();
	if (!collab) {
		return null;
	}

	// Build a quick lookup of element positions by ID
	const elementMap = new Map<string, PptxElement>();
	for (const el of elements) {
		elementMap.set(el.id, el);
	}

	// Collect remote selections on this slide
	const selections: Array<{
		userName: string;
		userColor: string;
		element: PptxElement;
	}> = [];

	for (const user of collab.remoteUsers) {
		if (user.activeSlideIndex === activeSlideIndex && user.selectedElementId) {
			const el = elementMap.get(user.selectedElementId);
			if (el) {
				selections.push({
					userName: user.userName,
					userColor: user.userColor,
					element: el,
				});
			}
		}
	}

	if (selections.length === 0) {
		return null;
	}

	return (
		<>
			{selections.map((sel) => (
				<div
					key={`remote-sel-${sel.element.id}`}
					data-testid={`remote-selection-${sel.element.id}`}
					data-export-ignore='true'
					className='absolute pointer-events-none'
					style={{
						left: sel.element.x,
						top: sel.element.y,
						width: sel.element.width,
						height: sel.element.height,
						zIndex: 9997,
						border: `2px solid ${sel.userColor}`,
						borderRadius: 2,
					}}
				>
					{/* User name label */}
					<span
						className='absolute -top-5 left-0 px-1 py-0.5 text-[9px] font-medium text-white rounded-sm whitespace-nowrap leading-none'
						style={{ backgroundColor: sel.userColor }}
					>
						{sel.userName}
					</span>
				</div>
			))}
		</>
	);
}
