/**
 * Performance-contract tests for the shared no-op-write guards.
 *
 * These assert IDENTITY, not just value equality. That is the whole contract:
 * every binding decides whether to re-render by comparing references, so a
 * producer returning a fresh-but-equivalent object is indistinguishable from a
 * real change and costs a full render in React, Vue, Angular, Svelte and
 * Vanilla alike (issue #145).
 */
import { describe, it, expect, vi } from 'vitest';

import type { SanitizedPresence } from './collaboration-presence';
import { createPresencePublisher } from './collaboration-presence-publisher';
import type { AwarenessLike } from './collaboration-presence-publisher';
import { createInitialPresentationSnapshot } from './presentation-session';
import {
	createPresenterTimer,
	mergePresentationSnapshot,
	presenterElapsed,
} from './presenter-console';
import { presenceListsEqual, presentationSnapshotsEqual } from './state-equality';

describe('mergePresentationSnapshot no-op guard', () => {
	it('returns the SAME object when the patch changes nothing', () => {
		const snapshot = createInitialPresentationSnapshot(2);

		expect(mergePresentationSnapshot(snapshot, {})).toBe(snapshot);
		expect(mergePresentationSnapshot(snapshot, { slideIndex: 2 })).toBe(snapshot);
		expect(mergePresentationSnapshot(snapshot, { blackout: 'none', paused: false })).toBe(snapshot);
	});

	it('does not advance `sequence` on a no-op merge', () => {
		const snapshot = createInitialPresentationSnapshot();
		const merged = mergePresentationSnapshot(snapshot, { elapsedMs: 0 });
		expect(merged.sequence).toBe(snapshot.sequence);
	});

	it('still returns a new object, and advances `sequence`, on a real change', () => {
		const snapshot = createInitialPresentationSnapshot();
		const merged = mergePresentationSnapshot(snapshot, { blackout: 'black' });

		expect(merged).not.toBe(snapshot);
		expect(merged.blackout).toBe('black');
		expect(merged.sequence).toBe(snapshot.sequence + 1);
	});

	it('survives a repeated idle presenter tick without allocating', () => {
		// The exact shape of the issue #145 tick: the same paused flag and the
		// same elapsed reading, pushed once a second. Ten ticks must not produce
		// ten new snapshots. The clock is read at a pinned `now`, so every tick
		// genuinely reports the same elapsed value.
		let snapshot = createInitialPresentationSnapshot();
		const timer = createPresenterTimer(0);
		const first = snapshot;

		for (let tick = 0; tick < 10; tick += 1) {
			snapshot = mergePresentationSnapshot(snapshot, {
				paused: timer.paused,
				elapsedMs: presenterElapsed(timer, 0),
			});
		}

		expect(snapshot).toBe(first);
	});

	it('treats a clamped zoom that lands on the current value as unchanged', () => {
		const snapshot = createInitialPresentationSnapshot();
		// Below PRESENTER_ZOOM_MIN, so it clamps back to the current scale of 1.
		const merged = mergePresentationSnapshot(snapshot, {
			zoom: { scale: 0.25, originX: 0.5, originY: 0.5 },
		});
		expect(merged).toBe(snapshot);
	});

	it('ignores `sequence` when comparing snapshots', () => {
		const a = createInitialPresentationSnapshot();
		expect(presentationSnapshotsEqual(a, { ...a, sequence: a.sequence + 99 })).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------

function presence(overrides: Partial<SanitizedPresence> = {}): SanitizedPresence {
	return {
		clientId: 1,
		userName: 'Ada',
		userColor: '#ef4444',
		activeSlideIndex: 0,
		cursorX: 10,
		cursorY: 20,
		lastUpdated: new Date(0).toISOString(),
		...overrides,
	};
}

describe('presenceListsEqual', () => {
	it('ignores `lastUpdated`, so an idle peer heartbeat is not a change', () => {
		const before = [presence()];
		const after = [presence({ lastUpdated: new Date(10_000).toISOString() })];
		expect(presenceListsEqual(before, after)).toBeTruthy();
	});

	it('detects a moved cursor', () => {
		expect(presenceListsEqual([presence()], [presence({ cursorX: 11 })])).toBeFalsy();
	});

	it('detects a peer joining or leaving', () => {
		expect(presenceListsEqual([presence()], [])).toBeFalsy();
		expect(presenceListsEqual([presence()], [presence(), presence({ clientId: 2 })])).toBeFalsy();
	});

	it('detects a changed selection', () => {
		expect(presenceListsEqual([presence()], [presence({ selectedElementId: 'el-1' })])).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------

function fakeAwareness(): { awareness: AwarenessLike; publishes: () => number } {
	const setLocalStateField = vi.fn();
	return {
		awareness: {
			clientID: 1,
			setLocalStateField,
			getStates: () => new Map(),
			on: () => {},
			off: () => {},
		},
		publishes: () => setLocalStateField.mock.calls.length,
	};
}

describe('presence publisher no-op guard', () => {
	it('does not publish an update that changes nothing', () => {
		const { awareness, publishes } = fakeAwareness();
		const publisher = createPresencePublisher(awareness, {
			userName: 'Ada',
			userColor: '#ef4444',
		});
		const afterAnnounce = publishes();

		// The local state starts at cursor (0, 0) on slide 0, and the constructor
		// already announced exactly that.
		publisher.update({ cursorX: 0, cursorY: 0 });
		publisher.update({ activeSlideIndex: 0 });
		publisher.update({});

		expect(publishes()).toBe(afterAnnounce);
		publisher.dispose();
	});

	it('still publishes a real move', () => {
		const { awareness, publishes } = fakeAwareness();
		const publisher = createPresencePublisher(awareness, {
			userName: 'Ada',
			userColor: '#ef4444',
		});
		const afterAnnounce = publishes();

		publisher.update({ cursorX: 5, cursorY: 5 });

		expect(publishes()).toBe(afterAnnounce + 1);
		publisher.dispose();
	});

	it('keeps the heartbeat publishing even when nothing changed', () => {
		// `flush` is the anti-timeout heartbeat: it must NOT be suppressed by the
		// no-op guard, or peers would drop us from their presence lists.
		const { awareness, publishes } = fakeAwareness();
		const publisher = createPresencePublisher(awareness, {
			userName: 'Ada',
			userColor: '#ef4444',
		});
		const afterAnnounce = publishes();

		publisher.flush();
		publisher.flush();

		expect(publishes()).toBe(afterAnnounce + 2);
		publisher.dispose();
	});
});
