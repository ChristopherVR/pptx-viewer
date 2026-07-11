import { describe, expect, it } from 'vitest';

import {
	buildShareConfig,
	canStartShare,
	isPeerToPeerShare,
	seedShareFields,
} from './share-helpers';

describe('seedShareFields', () => {
	it('defaults every field to an empty string when no defaults are supplied', () => {
		expect(seedShareFields()).toStrictEqual({ roomId: '', userName: '', serverUrl: '' });
	});

	it('seeds from the supplied defaults, falling back per-field', () => {
		expect(seedShareFields({ roomId: 'room-1', userName: 'Ada' })).toStrictEqual({
			roomId: 'room-1',
			userName: 'Ada',
			serverUrl: '',
		});
	});
});

describe('canStartShare', () => {
	it('requires both a room id and a display name', () => {
		expect(canStartShare({ roomId: '', userName: '', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'room-1', userName: '', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: '', userName: 'Ada', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'room-1', userName: 'Ada', serverUrl: '' })).toBeTruthy();
	});

	it('rejects whitespace-only values', () => {
		expect(canStartShare({ roomId: '   ', userName: '  ', serverUrl: '' })).toBeFalsy();
	});
});

describe('isPeerToPeerShare', () => {
	it('is true for a blank server url', () => {
		expect(isPeerToPeerShare('')).toBeTruthy();
		expect(isPeerToPeerShare('   ')).toBeTruthy();
	});

	it('is false for a non-blank server url', () => {
		expect(isPeerToPeerShare('wss://collab.example.com')).toBeFalsy();
	});
});

describe('buildShareConfig', () => {
	it('returns null when the form is incomplete', () => {
		expect(buildShareConfig({ roomId: '', userName: 'Ada', serverUrl: '' })).toBeNull();
	});

	it('trims fields and derives the websocket transport from a non-blank server url', () => {
		expect(
			buildShareConfig({ roomId: ' room-1 ', userName: ' Ada ', serverUrl: ' wss://x ' }),
		).toStrictEqual({
			roomId: 'room-1',
			userName: 'Ada',
			serverUrl: 'wss://x',
			transport: 'websocket',
		});
	});

	it('derives the webrtc transport from a blank server url', () => {
		expect(buildShareConfig({ roomId: 'room-1', userName: 'Ada', serverUrl: '' })).toStrictEqual({
			roomId: 'room-1',
			userName: 'Ada',
			serverUrl: '',
			transport: 'webrtc',
		});
	});
});
