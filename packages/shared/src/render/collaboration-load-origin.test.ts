import { describe, expect, it } from 'vitest';

import { shouldRoomSlidesReplaceLoad } from './collaboration-load-origin';

describe('shouldRoomSlidesReplaceLoad', () => {
	it('lets the room win over the deck the host mounted with', () => {
		// The case the rule exists for: a late joiner whose bootstrap deck parses
		// slower than the doc sync would otherwise clobber the room's slides.
		expect(shouldRoomSlidesReplaceLoad('bootstrap', 12)).toBeTruthy();
	});

	it('keeps a deck the user opened during the session', () => {
		// Joining a room and then opening a file used to lose the file: it was
		// parsed, committed, and immediately replaced by the room's starter deck.
		expect(shouldRoomSlidesReplaceLoad('user', 12)).toBeFalsy();
	});

	it('keeps any deck when the room is empty (this client is the seeder)', () => {
		expect(shouldRoomSlidesReplaceLoad('bootstrap', 0)).toBeFalsy();
		expect(shouldRoomSlidesReplaceLoad('user', 0)).toBeFalsy();
	});

	it('treats an unstated origin as the user, which keeps the deck', () => {
		// A binding that has not been taught to say must not silently drop a deck.
		expect(shouldRoomSlidesReplaceLoad(undefined, 12)).toBeFalsy();
	});
});
