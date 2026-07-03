import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INITIAL_SYNC_GRACE_MS } from './collaboration-presence';
import { createSyncGate } from './collaboration-sync-gate';

describe('createSyncGate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts closed and opens on the provider sync signal', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		expect(gate.isOpen()).toBeFalsy();
		gate.open();
		expect(gate.isOpen()).toBeTruthy();
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('opens after the grace period when armed without a sync signal', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		gate.arm();
		expect(gate.isOpen()).toBeFalsy();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS - 1);
		expect(gate.isOpen()).toBeFalsy();
		vi.advanceTimersByTime(1);
		expect(gate.isOpen()).toBeTruthy();
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('fires onOpen exactly once even with sync signal plus grace timer', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		gate.arm();
		gate.open();
		gate.open();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS * 2);
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('re-arming restarts the grace timer', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		gate.arm();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS - 1);
		gate.arm();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS - 1);
		expect(gate.isOpen()).toBeFalsy();
		vi.advanceTimersByTime(1);
		expect(gate.isOpen()).toBeTruthy();
	});

	it('arming after the gate opened does not schedule another onOpen', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		gate.open();
		gate.arm();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS * 2);
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('reset closes the gate, cancels the timer, and allows a fresh session', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen);
		gate.arm();
		gate.reset();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS * 2);
		expect(gate.isOpen()).toBeFalsy();
		expect(onOpen).not.toHaveBeenCalled();

		gate.arm();
		vi.advanceTimersByTime(INITIAL_SYNC_GRACE_MS);
		expect(gate.isOpen()).toBeTruthy();
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it('honours a custom grace period', () => {
		const onOpen = vi.fn();
		const gate = createSyncGate(onOpen, 100);
		gate.arm();
		vi.advanceTimersByTime(99);
		expect(gate.isOpen()).toBeFalsy();
		vi.advanceTimersByTime(1);
		expect(gate.isOpen()).toBeTruthy();
	});
});
