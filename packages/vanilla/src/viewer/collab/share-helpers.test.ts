import { describe, expect, it } from 'vitest';

import { buildShareConfig, canStartShare, seedShareFields } from './share-helpers';

describe('seedShareFields', () => {
	it('coerces absent defaults to empty strings', () => {
		expect(seedShareFields()).toStrictEqual({ roomId: '', userName: '', serverUrl: '' });
	});

	it('seeds fields from the given defaults', () => {
		expect(seedShareFields({ roomId: 'r1', userName: 'Ada', serverUrl: 'ws://x' })).toStrictEqual({
			roomId: 'r1',
			userName: 'Ada',
			serverUrl: 'ws://x',
		});
	});
});

describe('canStartShare', () => {
	it('requires a non-blank room id and name', () => {
		expect(canStartShare({ roomId: '', userName: 'Ada', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'r1', userName: '  ', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'r1', userName: 'Ada', serverUrl: '' })).toBeTruthy();
	});

	it('allows a blank server url (peer-to-peer)', () => {
		expect(canStartShare({ roomId: 'r1', userName: 'Ada', serverUrl: '' })).toBeTruthy();
	});
});

describe('buildShareConfig', () => {
	it('returns null when the form is incomplete', () => {
		expect(buildShareConfig({ roomId: '', userName: '', serverUrl: '' })).toBeNull();
	});

	it('trims fields and defaults to the collaborator role', () => {
		const config = buildShareConfig({ roomId: ' r1 ', userName: ' Ada ', serverUrl: ' ws://x ' });
		expect(config).toStrictEqual({
			roomId: 'r1',
			userName: 'Ada',
			serverUrl: 'ws://x',
			transport: 'websocket',
			role: 'collaborator',
		});
	});

	it('selects the webrtc transport for a blank server url', () => {
		const config = buildShareConfig({ roomId: 'r1', userName: 'Ada', serverUrl: '' });
		expect(config?.transport).toBe('webrtc');
	});
});
