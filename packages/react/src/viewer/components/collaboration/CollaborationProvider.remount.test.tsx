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

import type { CollaborationConfig } from '../../hooks/collaboration/types';

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
		retry: () => {},
	}),
	isMixedContentBlocked: () => false,
}));

const { CollaborationProvider, useCollaboration } = await import('./CollaborationProvider');

const CONFIG: CollaborationConfig = {
	roomId: 'room-1',
	serverUrl: 'wss://example.test',
	userName: 'Alice',
};

let container: HTMLDivElement;
let root: Root;
let mountCount = 0;

function Child(): React.ReactElement {
	const collab = useCollaboration();
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
