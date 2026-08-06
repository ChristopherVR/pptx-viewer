// @vitest-environment happy-dom
/**
 * Performance contract for presence tracking (issue #145 class).
 *
 * Yjs awareness fires for every peer heartbeat and for our own local writes.
 * Each peer re-stamps `lastUpdated` on a fixed interval, so those events carry
 * no visible change, yet `derivePresenceList` allocates a fresh array per call
 * and `setState` with a fresh array always re-renders. The result was a
 * collaboration layer that re-rendered on a timer in an idle room.
 *
 * These tests count RENDERS, not values: a hook that returns an equivalent but
 * freshly-allocated list is indistinguishable from a real change to React.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Awareness } from 'y-protocols/awareness';

import { usePresenceTracking } from './usePresenceTracking';

const LOCAL_ID = 1;
const PEER_ID = 2;

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

function createAwareness() {
	const states = new Map<number, Record<string, unknown>>();
	const listeners = new Set<() => void>();
	return {
		clientID: LOCAL_ID,
		states,
		setLocalStateField(field: string, value: unknown) {
			states.set(LOCAL_ID, { ...(states.get(LOCAL_ID) ?? {}), [field]: value });
		},
		getStates: () => states,
		on: (_event: string, cb: () => void) => listeners.add(cb),
		off: (_event: string, cb: () => void) => listeners.delete(cb),
		/** Fire an awareness event without changing any state. */
		emit() {
			listeners.forEach((cb) => cb());
		},
		/** Publish a peer presence and fire the awareness event, as Yjs would. */
		emitPeer(overrides: Record<string, unknown> = {}) {
			states.set(PEER_ID, {
				presence: {
					userName: 'Grace',
					userColor: '#22c55e',
					activeSlideIndex: 0,
					cursorX: 100,
					cursorY: 200,
					lastUpdated: new Date().toISOString(),
					...overrides,
				},
			});
			listeners.forEach((cb) => cb());
		},
	};
}

function renderHook(awareness: ReturnType<typeof createAwareness>, onRender: () => void) {
	function Harness(): null {
		onRender();
		usePresenceTracking({
			awareness: awareness as unknown as Awareness,
			localClientId: LOCAL_ID,
			userName: 'Ada',
			userColor: '#ef4444',
			canvasWidth: 960,
			canvasHeight: 540,
		});
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
}

describe('presence tracking render cost (issue #145)', () => {
	it('does not re-render on peer heartbeats that change nothing visible', () => {
		const awareness = createAwareness();
		const onRender = vi.fn();
		renderHook(awareness, onRender);

		// One real appearance: the peer joins. This SHOULD render.
		act(() => {
			awareness.emitPeer();
		});
		const afterJoin = onRender.mock.calls.length;

		// Ten heartbeats from a peer that has not moved. Only `lastUpdated`
		// differs, which is exactly what the shared projector is there to ignore.
		for (let beat = 0; beat < 10; beat += 1) {
			act(() => {
				awareness.emitPeer({ lastUpdated: new Date(Date.now() + beat * 1000).toISOString() });
			});
		}

		expect(onRender.mock.calls.length - afterJoin).toBe(0);
	});

	it('still re-renders when a peer actually moves', () => {
		const awareness = createAwareness();
		const onRender = vi.fn();
		renderHook(awareness, onRender);

		act(() => {
			awareness.emitPeer();
		});
		const afterJoin = onRender.mock.calls.length;

		act(() => {
			awareness.emitPeer({ cursorX: 400 });
		});

		expect(onRender.mock.calls.length).toBeGreaterThan(afterJoin);
	});

	it('re-renders when a peer leaves', () => {
		const awareness = createAwareness();
		const onRender = vi.fn();
		renderHook(awareness, onRender);

		act(() => {
			awareness.emitPeer();
		});
		const afterJoin = onRender.mock.calls.length;

		act(() => {
			awareness.states.delete(PEER_ID);
			awareness.emit();
		});

		expect(onRender.mock.calls.length).toBeGreaterThan(afterJoin);
	});
});
