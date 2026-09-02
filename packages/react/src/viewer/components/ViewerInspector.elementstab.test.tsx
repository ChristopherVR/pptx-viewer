// @vitest-environment happy-dom
/**
 * The Elements tab is a per-slide layer list, not a per-element panel.
 *
 * `ViewerInspector` used to bail out (`return null`) for any tab other than
 * comments/properties when nothing was selected, which meant clicking
 * "Elements" with an empty selection closed the entire inspector - precisely
 * when the layer list is most useful, since it is where you go to FIND the
 * object to select (or to un-hide one you can no longer click).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { UseCommentsResult } from '../hooks/useComments-helpers';
import { ViewerInspector } from './ViewerInspector';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

const slide = {
	id: 'ppt/slides/slide1.xml',
	slideNumber: 1,
	elements: [
		{ id: 'sp_1', type: 'shape', x: 0, y: 0, width: 10, height: 10 },
		{ id: 'sp_2', type: 'shape', x: 0, y: 0, width: 10, height: 10, hidden: true },
	],
} as unknown as PptxSlide;

const comments = {
	commentDraftBySlideId: {},
	editingCommentIdBySlideId: {},
	commentEditDraftByCommentId: {},
	replyingToCommentId: null,
	replyDraftByCommentId: {},
	commentDraftMentionsBySlideId: {},
	replyDraftMentionsByCommentId: {},
	handleCommentDraftChange: vi.fn<() => void>(),
	handleAddSlideComment: vi.fn<() => void>(),
	handleDeleteSlideComment: vi.fn<() => void>(),
	handleStartCommentEdit: vi.fn<() => void>(),
	handleCancelCommentEdit: vi.fn<() => void>(),
	handleSaveCommentEdit: vi.fn<() => void>(),
	handleSetCommentEditDraft: vi.fn<() => void>(),
	handleToggleCommentResolved: vi.fn<() => void>(),
	handleStartReply: vi.fn<() => void>(),
	handleCancelReply: vi.fn<() => void>(),
	handleReplyDraftChange: vi.fn<() => void>(),
	handleSubmitReply: vi.fn<() => void>(),
} as unknown as UseCommentsResult;

function renderInspector(tab: string): void {
	act(() => {
		root.render(
			<ViewerInspector
				isOpen
				canEdit
				mode='editor'
				activeSlide={slide}
				slides={[slide]}
				canvasSize={{ width: 1280, height: 720 }}
				selectedElement={null}
				effectiveSelectedIds={[]}
				sidebarPanelMode={tab}
				activeSlideIndex={0}
				comments={comments}
				onSetSidebarPanelMode={vi.fn<() => void>()}
				onClose={vi.fn<() => void>()}
				onUpdateElementStyle={vi.fn<() => void>()}
				onUpdateTextStyle={vi.fn<() => void>()}
				onUpdateElement={vi.fn<() => void>()}
				onApplySelection={vi.fn<() => void>()}
				onSetCanvasSize={vi.fn<() => void>()}
				onMoveLayer={vi.fn<() => void>()}
				onMoveLayerToEdge={vi.fn<() => void>()}
				onDeleteElement={vi.fn<() => void>()}
				onUpdateSlide={vi.fn<() => void>()}
				presentationProperties={{}}
				onUpdatePresentationProperties={vi.fn<() => void>()}
				customProperties={[]}
				themeOptions={[]}
				onUpdateCoreProperties={vi.fn<() => void>()}
				onUpdateAppProperties={vi.fn<() => void>()}
				onUpdateCustomProperties={vi.fn<() => void>()}
				onApplyTheme={vi.fn<() => void>()}
			/>,
		);
	});
}

describe('viewerInspector tab gating with no selection', () => {
	it('keeps the pane open on the Elements tab', () => {
		renderInspector('elements');
		expect(container.querySelector('[data-pptx-inspector]')).not.toBeNull();
	});

	it('lists the slide layers, hidden ones included, with nothing selected', () => {
		renderInspector('elements');
		const pane = container.querySelector('[data-pptx-inspector]');
		expect(pane?.textContent ?? '').toContain('Layer Order');
		// One visibility toggle per element on the slide.
		expect(
			container.querySelectorAll('[title="Show element"], [title="Hide element"]'),
		).toHaveLength(2);
	});

	it('still renders the comments and properties tabs', () => {
		for (const tab of ['comments', 'properties']) {
			renderInspector(tab);
			expect(container.querySelector('[data-pptx-inspector]')).not.toBeNull();
		}
	});
});
