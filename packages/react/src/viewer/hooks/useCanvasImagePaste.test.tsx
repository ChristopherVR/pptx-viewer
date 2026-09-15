// @vitest-environment jsdom
import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSlideCanvasImagePaste } from '../components/canvas/useSlideCanvasImagePaste';
import { useCanvasImagePaste } from './useCanvasImagePaste';
import type { ViewerState } from './useViewerState';

vi.mock(import('pptx-viewer-shared'), () => ({ attachEditorImagePaste: vi.fn() }));

const cleanups: (() => void)[] = [];
let detach = vi.fn();
beforeEach(() => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	detach = vi.fn();
	vi.mocked(attachEditorImagePaste).mockReset().mockReturnValue(detach);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function setup() {
	const zoom = {
		editorScale: 1,
		canvasStageRef: createRef<HTMLDivElement>(),
		canvasViewportRef: createRef<HTMLDivElement>(),
		editWrapperRef: createRef<HTMLDivElement>(),
	};
	let props: Parameters<typeof useCanvasImagePaste>[0] = {
		canEdit: true,
		mode: 'edit',
		insertElement: vi.fn(),
		state: {
			containerRef: createRef<HTMLDivElement>(),
			loading: false,
			error: null,
			activeSlide: { id: 'slide-1' },
			canvasSize: { width: 960, height: 540 },
			activeTool: 'select',
			editTemplateMode: false,
			inlineEditingElementId: null,
			tableEditorState: null,
			contextMenuState: null,
		} as unknown as ViewerState,
	};
	function Harness() {
		const imagePaste = useCanvasImagePaste(props);
		useSlideCanvasImagePaste({
			imagePaste,
			zoom,
			canEdit: props.canEdit,
			mode: props.mode,
			activeSlide: props.state.activeSlide,
			editTemplateMode: props.state.editTemplateMode,
			inlineEditingElementId: props.state.inlineEditingElementId,
			tableEditorState: props.state.tableEditorState,
			activeTool: props.state.activeTool,
		});
		return (
			<div ref={zoom.canvasViewportRef}>
				<div ref={zoom.canvasStageRef} />
			</div>
		);
	}
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	const render = () => act(() => root.render(<Harness />));
	render();
	cleanups.push(() => {
		act(() => root.unmount());
		host.remove();
	});
	return {
		options: () => vi.mocked(attachEditorImagePaste).mock.lastCall![1] as EditorImagePasteOptions,
		state: () => props.state,
		update: (patch: Partial<typeof props>, state: Partial<ViewerState> = {}) => {
			props = { ...props, ...patch, state: { ...props.state, ...state } };
			render();
		},
	};
}

describe('useCanvasImagePaste', () => {
	it('binds the owning root and canvas in the stock/headless shared operations hook', () => {
		const editor = setup();
		expect(attachEditorImagePaste).toHaveBeenCalledOnce();
		expect(editor.options().getCanvas()).toBeInstanceOf(HTMLElement);
		expect(editor.options().getTarget()).toMatchObject({
			slideId: 'slide-1',
			canvasSize: { width: 960, height: 540 },
		});
	});

	it.each([
		{ loading: true },
		{ error: 'load failed' },
		{ editTemplateMode: true },
		{ inlineEditingElementId: 'text' },
		{ activeTool: 'pen' },
		{ tableEditorState: { isEditing: true } },
		{ contextMenuState: { x: 1, y: 1 } },
		{ activeSlide: undefined },
	])('declines an ineligible editor state: %j', (state) => {
		const editor = setup();
		editor.update({}, state as Partial<ViewerState>);
		expect(editor.options().getTarget()).toBeNull();
	});

	it.each(['readonly', 'present', 'master'])(
		'declines %s mode but retains nested-viewer ownership',
		(mode) => {
			const editor = setup();
			editor.update(
				mode === 'readonly' ? { canEdit: false } : { mode: mode as 'present' | 'master' },
			);
			expect(editor.options().getTarget()).toBeNull();
			expect(attachEditorImagePaste).toHaveBeenCalledTimes(2);
		},
	);

	it.each(['permission', 'load', 'slide'])(
		'disposes the old decode on %s away-and-back transitions',
		(change) => {
			const editor = setup();
			const original = editor.state();
			if (change === 'permission') {
				editor.update({ canEdit: false });
				editor.update({ canEdit: true });
			}
			if (change === 'load') {
				editor.update({}, { loading: true });
				editor.update({}, { loading: false });
			}
			if (change === 'slide') {
				editor.update({}, { activeSlide: { ...original.activeSlide!, id: 'slide-2' } });
				editor.update({}, { activeSlide: original.activeSlide });
			}
			expect(detach).toHaveBeenCalledTimes(2);
		},
	);

	it('does not rebind on an ordinary element edit to the same slide', () => {
		const editor = setup();
		editor.update({}, { activeSlide: { ...editor.state().activeSlide!, elements: [] } });
		expect(detach).not.toHaveBeenCalled();
	});
});
