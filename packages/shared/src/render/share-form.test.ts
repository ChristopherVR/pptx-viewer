import { describe, expect, it } from 'vitest';

import {
	buildJoinConfig,
	buildShareConfig,
	canJoinShare,
	canStartShare,
	isPeerToPeerShare,
	seedShareFields,
} from './share-form';

describe('seedShareFields', () => {
	it('defaults every field to an empty string', () => {
		expect(seedShareFields()).toStrictEqual({ roomId: '', userName: '', serverUrl: '' });
	});

	it('coerces absent values while keeping supplied ones', () => {
		expect(seedShareFields({ roomId: 'room-1', userName: 'Ada' })).toStrictEqual({
			roomId: 'room-1',
			userName: 'Ada',
			serverUrl: '',
		});
	});
});

describe('canStartShare', () => {
	it('requires a non-blank room id and display name', () => {
		expect(canStartShare({ roomId: '', userName: 'Ada', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'room-1', userName: '  ', serverUrl: '' })).toBeFalsy();
		expect(canStartShare({ roomId: 'room-1', userName: 'Ada', serverUrl: '' })).toBeTruthy();
	});
});

describe('isPeerToPeerShare', () => {
	it('treats a blank server as peer-to-peer', () => {
		expect(isPeerToPeerShare('')).toBeTruthy();
		expect(isPeerToPeerShare('   ')).toBeTruthy();
	});

	it('treats a websocket server as not peer-to-peer', () => {
		expect(isPeerToPeerShare('wss://collab.example.com')).toBeFalsy();
	});
});

describe('buildShareConfig', () => {
	it('returns null when incomplete', () => {
		expect(buildShareConfig({ roomId: '', userName: 'Ada', serverUrl: '' })).toBeNull();
	});

	it('trims fields and assembles a create config', () => {
		const config = buildShareConfig({ roomId: ' room-1 ', userName: ' Ada ', serverUrl: '' });
		expect(config).not.toBeNull();
		expect(config?.roomId).toBe('room-1');
		expect(config?.userName).toBe('Ada');
		expect(config?.role).toBe('collaborator');
	});
});

describe('join helpers', () => {
	it('canJoinShare rejects a blank invitation', () => {
		expect(canJoinShare({ invitation: '', userName: 'Ada', serverUrl: '' })).toBeFalsy();
	});

	it('buildJoinConfig assembles a join config from a room id', () => {
		const config = buildJoinConfig({ invitation: 'room-9', userName: 'Ada', serverUrl: '' });
		expect(config).not.toBeNull();
		expect(config?.roomId).toBe('room-9');
	});
});
