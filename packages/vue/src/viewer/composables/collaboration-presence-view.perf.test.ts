/**
 * Performance contract for the Vue presence projection (issue #145 class).
 *
 * Assigning a `ref` triggers whether or not the value differs, so a
 * fresh-but-equivalent array re-renders the cursor overlay. Peer heartbeats
 * re-stamp `lastUpdated` on a fixed interval, which meant an idle room
 * re-rendered forever.
 *
 * The assertions cover both the `changed` flag the composable early-returns on
 * and the reference identity of the mapped `RemotePresence[]`, since the Vue
 * mapping is memoised on top of the shared projector.
 */
import { describe, expect, it } from 'vitest';

import { createPresenceProjection } from './collaboration-presence-view';

const LOCAL_ID = 1;
const PEER_ID = 2;

function states(overrides: Record<string, unknown> = {}): Map<number, Record<string, unknown>> {
	return new Map<number, Record<string, unknown>>([
		[
			PEER_ID,
			{
				presence: {
					userName: 'Grace',
					userColor: '#22c55e',
					activeSlideIndex: 0,
					cursorX: 100,
					cursorY: 200,
					lastUpdated: new Date().toISOString(),
					...overrides,
				},
			},
		],
	]);
}

function project(
	projection: ReturnType<typeof createPresenceProjection>,
	overrides?: Record<string, unknown>,
	activeSlide = 0,
) {
	return projection.project(states(overrides), LOCAL_ID, 960, 540, activeSlide);
}

describe('vue presence projection cost (issue #145)', () => {
	it('reports no change, and reuses both arrays, across peer heartbeats', () => {
		const projection = createPresenceProjection();

		const join = project(projection);
		expect(join.changed).toBeTruthy();
		expect(join.presences).toHaveLength(1);

		for (let beat = 0; beat < 10; beat += 1) {
			const beatResult = project(projection, {
				lastUpdated: new Date(Date.now() + beat * 1000).toISOString(),
			});
			expect(beatResult.changed).toBeFalsy();
			expect(beatResult.presences).toBe(join.presences);
			expect(beatResult.cursors).toBe(join.cursors);
		}
	});

	it('reports a change when a peer moves', () => {
		const projection = createPresenceProjection();
		const join = project(projection);

		const moved = project(projection, { cursorX: 400 });

		expect(moved.changed).toBeTruthy();
		expect(moved.presences).not.toBe(join.presences);
		expect(moved.presences[0]?.cursor.x).toBe(400);
	});

	it('reports a change when the local user changes slide', () => {
		// Cursors are filtered to the local slide, so a peer that did not move
		// still needs re-projecting when WE navigate.
		const projection = createPresenceProjection();
		project(projection, undefined, 0);

		const afterNavigate = project(projection, undefined, 1);

		expect(afterNavigate.changed).toBeTruthy();
		expect(afterNavigate.cursors).toHaveLength(0);
	});

	it('reports a change after a reset, so a re-join is never memoised away', () => {
		const projection = createPresenceProjection();
		project(projection);
		projection.reset();

		expect(project(projection).changed).toBeTruthy();
	});
});
