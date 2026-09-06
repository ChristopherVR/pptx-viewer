import { describe, expect, it, vi } from 'vitest';

import type { ViewerState } from '../state';
import { createInitialViewerState, createStore } from '../state';
import type { DrawModeDeps, DrawModeStageInteractions } from './editor-draw-mode';
import { createDrawModeController } from './editor-draw-mode';

/** `createDrawModeController` with `doc` defaulted, so call sites that don't care about the live-preview overlay stay terse. */
function buildDrawMode(deps: Omit<DrawModeDeps, 'doc'>) {
	return createDrawModeController({ doc: document, ...deps });
}

/** `overrides` is contextually typed against `Partial<ViewerState>`, so string-literal
 * union fields like `drawTool` stay narrowed instead of widening to `string`. */
function buildState(overrides: Partial<ViewerState> = {}): ViewerState {
	return { ...createInitialViewerState(), ...overrides };
}

function fakePointerEvent(target: EventTarget | null = null): PointerEvent {
	return {
		clientX: 0,
		clientY: 0,
		pointerId: 1,
		button: 0,
		target,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as PointerEvent;
}

function buildInteractions(): DrawModeStageInteractions {
	return {
		onStagePointerDown: vi.fn(),
		onStageDblClick: vi.fn(),
		closeInline: vi.fn(),
	};
}

describe('createDrawModeController', () => {
	describe('setTool', () => {
		it('switches the store drawTool and clears selection when leaving select', () => {
			const store = createStore(buildState({ editable: true, selectedElementId: 'el-1' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.setTool('pen');

			expect(store.get().drawTool).toBe('pen');
			expect(store.get().selectedElementId).toBeNull();
			expect(interactions.closeInline).toHaveBeenCalledWith(true);
		});

		it('does not close inline editing or touch selection when switching to select', () => {
			const store = createStore(
				buildState({ editable: true, drawTool: 'pen', selectedElementId: null }),
			);
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.setTool('select');

			expect(store.get().drawTool).toBe('select');
			expect(interactions.closeInline).not.toHaveBeenCalled();
		});

		it('is a no-op (no store notification) when the tool does not change', () => {
			const store = createStore(buildState({ drawTool: 'pen' }));
			const listener = vi.fn();
			store.subscribe(listener);
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.setTool('pen');

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('setColor / setWidth', () => {
		it('sets drawColor verbatim', () => {
			const store = createStore(createInitialViewerState());
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions: buildInteractions(),
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.setColor('#123456');
			expect(store.get().drawColor).toBe('#123456');
		});

		it('clamps drawWidth to a minimum of 1 and rounds to the nearest integer', () => {
			const store = createStore(createInitialViewerState());
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions: buildInteractions(),
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.setWidth(6.6);
			expect(store.get().drawWidth).toBe(7);

			drawMode.setWidth(-4);
			expect(store.get().drawWidth).toBe(1);
		});
	});

	describe('routing', () => {
		it('routes pointerdown to the normal interactions when the tool is select', () => {
			const store = createStore(buildState({ editable: true, drawTool: 'select' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			const event = fakePointerEvent();
			drawMode.onStagePointerDown(event);

			expect(interactions.onStagePointerDown).toHaveBeenCalledWith(event);
		});

		it('routes pointerdown to the drawing gesture controller when a drawing tool is active', () => {
			const store = createStore(buildState({ editable: true, drawTool: 'pen' }));
			const interactions = buildInteractions();
			const commitStroke = vi.fn();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke, eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.onStagePointerDown(fakePointerEvent());

			expect(interactions.onStagePointerDown).not.toHaveBeenCalled();
		});

		it('falls back to the normal interactions when not editable, even with a drawing tool selected', () => {
			const store = createStore(buildState({ editable: false, drawTool: 'pen' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			const event = fakePointerEvent();
			drawMode.onStagePointerDown(event);

			expect(interactions.onStagePointerDown).toHaveBeenCalledWith(event);
		});

		it('falls back to the normal interactions while presenting', () => {
			const store = createStore(buildState({ editable: true, presenting: true, drawTool: 'pen' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			const event = fakePointerEvent();
			drawMode.onStagePointerDown(event);

			expect(interactions.onStagePointerDown).toHaveBeenCalledWith(event);
		});

		it('suppresses dblclick inline-edit while a drawing tool is active', () => {
			const store = createStore(buildState({ editable: true, drawTool: 'eraser' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			drawMode.onStageDblClick(new MouseEvent('dblclick'));

			expect(interactions.onStageDblClick).not.toHaveBeenCalled();
		});

		it('routes dblclick to the normal interactions when the tool is select', () => {
			const store = createStore(buildState({ editable: true, drawTool: 'select' }));
			const interactions = buildInteractions();
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions,
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			const event = new MouseEvent('dblclick');
			drawMode.onStageDblClick(event);

			expect(interactions.onStageDblClick).toHaveBeenCalledWith(event);
		});
	});

	describe('syncCursor', () => {
		it('sets data-draw-tool to the active tool while drawing is active', () => {
			const store = createStore(buildState({ editable: true, drawTool: 'highlighter' }));
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions: buildInteractions(),
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});
			const stageWrap = document.createElement('div');

			drawMode.syncCursor(stageWrap);

			expect(stageWrap.dataset.drawTool).toBe('highlighter');
		});

		it('falls back to select when not editable', () => {
			const store = createStore(buildState({ editable: false, drawTool: 'pen' }));
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions: buildInteractions(),
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});
			const stageWrap = document.createElement('div');

			drawMode.syncCursor(stageWrap);

			expect(stageWrap.dataset.drawTool).toBe('select');
		});

		it('is a no-op for a null stage wrap', () => {
			const store = createStore(createInitialViewerState());
			const drawMode = buildDrawMode({
				store,
				editActions: { commitStroke: vi.fn(), eraseInkElement: vi.fn() },
				interactions: buildInteractions(),
				getScale: () => 1,
				getStageOrigin: () => ({ left: 0, top: 0 }),
				getStageRoot: () => null,
			});

			expect(() => drawMode.syncCursor(null)).not.toThrow();
		});
	});
});
