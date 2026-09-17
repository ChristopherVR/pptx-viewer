// @vitest-environment happy-dom
import React, { act } from 'react';
/**
 * Regression test for the collaboration-toggle remount bug.
 *
 * Starting a session used to flip `PowerPointViewer` from rendering its editor
 * bare to wrapping it in a `<CollaborationProvider>`. That change in React tree
 * SHAPE unmounted and remounted the whole editor subtree, which could leave the
 * ResizeObserver-driven narrow-viewport breakpoint stuck in the compact mobile
 * UI on a desktop viewport. The fix renders the provider UNCONDITIONALLY and
 * lets it go dormant when no config is present, so toggling collaboration only
 * changes the context value, never the tree shape.
 *
 * This test locks in that invariant: a child rendered under the provider keeps
 * its mount identity (its mount effect runs exactly once) as `config` toggles
 * on and off, while the exposed collaboration context flips accordingly.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
	CollaborationConfig,
	CollaborationContextValue,
} from '../../hooks/collaboration/types';

const { retry } = vi.hoisted(() => ({ retry: () => {} }));

// Mock the transport layer so the provider never opens a real Yjs connection
// (no dynamic yjs/y-webrtc import, no network); we only care about tree shape.
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock(import('../../hooks/collaboration/useYjsProvider'), () => ({
	useYjsProvider: () => ({
		status: 'disconnected' as const,
		awareness: null,
		doc: null,
		clientId: null,
		synced: true,
		retry,
	}),
	isMixedContentBlocked: () => false,
}));

const { CollaborationProvider, useCollaboration } = await import('./CollaborationProvider');
const { CollaborationCursorOverlay } = await import('./CollaborationCursorOverlay');
const { RemoteSelectionOverlay } = await import('./RemoteSelectionOverlay');

const CONFIG: CollaborationConfig = {
	roomId: 'room-1',
	serverUrl: 'wss://example.test',
	userName: 'Alice',
};

let container: HTMLDivElement;
let root: Root;
let mountCount = 0;
let contextValue: CollaborationContextValue | null = null;

function Child(): React.ReactElement {
	const collab = useCollaboration();
	contextValue = collab;
	React.useEffect(() => {
		mountCount += 1;
	}, []);
	return <div data-testid='child' data-collab={collab ? 'on' : 'off'} />;
}

function renderWith(config?: CollaborationConfig): void {
	act(() => {
		root.render(
			<CollaborationProvider config={config} canvasWidth={960} canvasHeight={540}>
				<Child />
			</CollaborationProvider>,
		);
	});
}

function collabState(): string | null {
	return container.querySelector('[data-testid="child"]')?.getAttribute('data-collab') ?? null;
}

beforeEach(() => {
	mountCount = 0;
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

describe('collaborationProvider tree stability', () => {
	it('renders explicit remote selections without a provider and hides other slides', () => {
		const collaboration: CollaborationContextValue = {
			config: CONFIG,
			status: 'connected',
			synced: true,
			doc: null,
			connectedCount: 2,
			retry,
			broadcastPresence: () => {},
			remoteUsers: [
				{
					clientId: 2,
					userName: 'Peer',
					userColor: '#123456',
					activeSlideIndex: 0,
					selectedElementId: 'shape-1',
					cursorX: 0,
					cursorY: 0,
					lastUpdated: new Date().toISOString(),
				},
			],
		};
		const elements = [
			{ id: 'shape-1', type: 'text' as const, x: 20, y: 30, width: 200, height: 50 },
		];
		const render = (activeSlideIndex: number, value: CollaborationContextValue | null): void => {
			act(() =>
				root.render(
					<RemoteSelectionOverlay
						elements={elements}
						activeSlideIndex={activeSlideIndex}
						collaboration={value}
					/>,
				),
			);
		};
		render(0, collaboration);
		expect(container.querySelector('[data-pptx-remote-selection="shape-1"]')?.textContent).toBe(
			'Peer',
		);
		render(1, collaboration);
		expect(container.querySelector('[data-pptx-remote-selection]')).toBeNull();
		render(0, null);
		expect(container.querySelector('[data-pptx-remote-selection]')).toBeNull();
	});

	it('keeps pointer subscriptions stable but publishes active-slide changes', () => {
		const broadcastPresence = vi.fn();
		const renderOverlay = (activeSlideIndex: number): void => {
			act(() => {
				root.render(
					<div data-testid='canvas'>
						<CollaborationCursorOverlay
							collaboration={{
								config: CONFIG,
								status: 'connected',
								synced: true,
								doc: null,
								remoteUsers: [],
								connectedCount: 1,
								retry,
								broadcastPresence,
							}}
							activeSlideIndex={activeSlideIndex}
							canvasWidth={960}
							canvasHeight={540}
							selectedElementId='shape-1'
						/>
					</div>,
				);
			});
		};
		renderOverlay(0);
		const canvas = container.querySelector('[data-testid="canvas"]')!;
		const addListener = vi.spyOn(canvas, 'addEventListener');
		const removeListener = vi.spyOn(canvas, 'removeEventListener');
		broadcastPresence.mockClear();
		renderOverlay(0);
		expect(addListener).not.toHaveBeenCalled();
		expect(removeListener).not.toHaveBeenCalled();
		expect(broadcastPresence).not.toHaveBeenCalled();
		renderOverlay(1);
		expect(broadcastPresence).toHaveBeenCalledWith({
			selectedElementId: 'shape-1',
			activeSlideIndex: 1,
		});
		expect(addListener).toHaveBeenCalledOnce();
		expect(removeListener).toHaveBeenCalledOnce();
	});

	it('retains the context identity across unrelated parent renders', () => {
		renderWith(CONFIG);
		const previous = contextValue;
		renderWith(CONFIG);
		expect(contextValue).toBe(previous);
		expect(contextValue).not.toBeNull();
	});

	it('exposes a null context and mounts the child once when config is absent', () => {
		renderWith(undefined);
		expect(mountCount).toBe(1);
		expect(collabState()).toBe('off');
	});

	it('does not remount the child when a session starts (config toggles on)', () => {
		renderWith(undefined);
		expect(mountCount).toBe(1);
		expect(collabState()).toBe('off');

		renderWith(CONFIG);
		// The child subtree must survive the toggle: its mount effect ran once.
		expect(mountCount).toBe(1);
		// ...but the collaboration context is now active.
		expect(collabState()).toBe('on');
	});

	it('does not remount the child when a session stops (config toggles off)', () => {
		renderWith(CONFIG);
		expect(mountCount).toBe(1);
		expect(collabState()).toBe('on');

		renderWith(undefined);
		expect(mountCount).toBe(1);
		expect(collabState()).toBe('off');
	});
});
