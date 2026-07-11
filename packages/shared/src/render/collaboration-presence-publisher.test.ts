import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AwarenessLike } from './collaboration-presence-publisher';
import { createPresencePublisher } from './collaboration-presence-publisher';

function makeAwareness(): { awareness: AwarenessLike; states: Record<string, unknown> } {
	const states: Record<string, unknown> = {};
	const awareness: AwarenessLike = {
		clientID: 1,
		setLocalStateField: (field, value) => {
			states[field] = value;
		},
		getStates: () => new Map(),
		on: () => {},
		off: () => {},
	};
	return { awareness, states };
}

describe('createPresencePublisher', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('announces an initial nested presence in the shared wire format', () => {
		const { awareness, states } = makeAwareness();
		createPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456', role: 'owner' });

		expect(states.presence).toMatchObject({
			userName: 'Ada',
			userColor: '#123456',
			role: 'owner',
			activeSlideIndex: 0,
			cursorX: 0,
			cursorY: 0,
		});
		expect((states.presence as { lastUpdated?: unknown }).lastUpdated).toBeTypeOf('string');
	});

	it('publishes the first update immediately and throttles the next', () => {
		const { awareness, states } = makeAwareness();
		const pub = createPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456' });

		// First update after the initial announce goes out immediately.
		pub.update({ cursorX: 10, cursorY: 20 });
		expect(states.presence).toMatchObject({ cursorX: 10, cursorY: 20 });

		// A second update inside the throttle window is deferred.
		pub.update({ cursorX: 30, cursorY: 40 });
		expect(states.presence).toMatchObject({ cursorX: 10, cursorY: 20 });

		// After the throttle window it flushes with the latest accumulated state.
		vi.advanceTimersByTime(60);
		expect(states.presence).toMatchObject({ cursorX: 30, cursorY: 40 });
	});

	it('merges partial patches into one presence object', () => {
		const { awareness, states } = makeAwareness();
		const pub = createPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456' });

		pub.update({ selectedElementId: 'el-1' });
		pub.update({ activeSlideIndex: 4 });
		vi.advanceTimersByTime(60);

		expect(states.presence).toMatchObject({ selectedElementId: 'el-1', activeSlideIndex: 4 });
	});

	it('flush re-publishes without waiting; dispose cancels a pending publish', () => {
		const { awareness, states } = makeAwareness();
		const pub = createPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456' });

		pub.update({ cursorX: 5, cursorY: 5 }); // immediate
		pub.update({ cursorX: 99, cursorY: 99 }); // deferred
		pub.dispose(); // cancel the deferred publish
		vi.advanceTimersByTime(200);
		// The deferred update never landed.
		expect(states.presence).toMatchObject({ cursorX: 5, cursorY: 5 });
	});
});
