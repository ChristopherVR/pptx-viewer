/**
 * collaboration-local-presence.test.ts: unit tests for the presence-merge
 * helper that backs `CollaborationService.setCursor/setSelection/setActiveSlide`.
 *
 * The critical behaviour is that cursor, selection, and active-slide updates all
 * merge into ONE awareness `presence` record, so a later cursor move never
 * clobbers the selection (and vice-versa).
 */

import { describe, expect, it } from 'vitest';

import { LocalPresencePublisher } from './collaboration-local-presence';
import type { AwarenessLike } from './collaboration-providers';

interface PresenceRecord {
	activeSlideIndex: number;
	cursorX: number;
	cursorY: number;
	selectedElementId?: string;
	userName: string;
	userColor: string;
	role?: string;
}

function makeAwareness(): {
	awareness: AwarenessLike;
	fields: Map<string, unknown>;
} {
	const fields = new Map<string, unknown>();
	const awareness: AwarenessLike = {
		clientID: 1,
		setLocalStateField: (field, value) => fields.set(field, value),
		getStates: () => new Map(),
		on: () => {},
		off: () => {},
	};
	return { awareness, fields };
}

function presence(fields: Map<string, unknown>): PresenceRecord {
	return fields.get('presence') as PresenceRecord;
}

describe('localPresencePublisher', () => {
	it('publishes the identity on the initial publish', () => {
		const { awareness, fields } = makeAwareness();
		const pub = new LocalPresencePublisher(awareness, {
			userName: 'Ada',
			userColor: '#123456',
			role: 'owner',
		});
		pub.publish();
		expect(presence(fields)).toMatchObject({
			userName: 'Ada',
			userColor: '#123456',
			role: 'owner',
			activeSlideIndex: 0,
			cursorX: 0,
			cursorY: 0,
		});
	});

	it('merges cursor + selection + active slide without clobbering', () => {
		const { awareness, fields } = makeAwareness();
		const pub = new LocalPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456' });

		pub.setCursor(33, 44, 1);
		expect(presence(fields)).toMatchObject({ cursorX: 33, cursorY: 44, activeSlideIndex: 1 });

		// Selecting must preserve the previously-published cursor coordinates.
		pub.setSelection('el-7', 2);
		expect(presence(fields)).toMatchObject({
			cursorX: 33,
			cursorY: 44,
			selectedElementId: 'el-7',
			activeSlideIndex: 2,
		});

		// Moving the cursor again must preserve the selection.
		pub.setCursor(5, 6);
		expect(presence(fields)).toMatchObject({
			cursorX: 5,
			cursorY: 6,
			selectedElementId: 'el-7',
			activeSlideIndex: 2,
		});
	});

	it('clamps a negative or fractional active slide to a non-negative integer', () => {
		const { awareness, fields } = makeAwareness();
		const pub = new LocalPresencePublisher(awareness, { userName: 'Ada', userColor: '#123456' });
		pub.setActiveSlide(-3);
		expect(presence(fields).activeSlideIndex).toBe(0);
		pub.setActiveSlide(4.9);
		expect(presence(fields).activeSlideIndex).toBe(4);
	});
});
