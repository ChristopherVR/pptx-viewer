// @vitest-environment jsdom
/**
 * media-trim-fade-scheduler.test.ts: unit tests for scheduleMediaTrimAndFade
 * (G20). jsdom is required because the scheduler drives volume ramps through
 * `requestAnimationFrame`, which jsdom polyfills via a timer that
 * `vi.advanceTimersByTimeAsync` can drain (see `animation-playback-engine.test.ts`
 * for the same pattern). A hand-rolled `EventTarget` fake stands in for the
 * `<video>`/`<audio>` element so `currentTime`/`duration`/`paused` stay
 * fully writable, unlike jsdom's own (non-functional) media element.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { scheduleMediaTrimAndFade } from './media-trim-fade-scheduler';

class FakeMediaElement extends EventTarget {
	currentTime = 0;
	duration = NaN;
	volume = 1;
	paused = true;

	pause(): void {
		this.paused = true;
	}
}

function asMediaElement(fake: FakeMediaElement): HTMLMediaElement {
	return fake as unknown as HTMLMediaElement;
}

/** Simulate the browser starting playback: paused flips false, `play` fires. */
function firePlay(fake: FakeMediaElement): void {
	fake.paused = false;
	fake.dispatchEvent(new Event('play'));
}

afterEach(() => {
	vi.useRealTimers();
});

describe('scheduleMediaTrimAndFade', () => {
	it('is a no-op (nothing scheduled) when the source has no trim or fade', () => {
		const fake = new FakeMediaElement();
		const cancel = scheduleMediaTrimAndFade(asMediaElement(fake), {});
		firePlay(fake);
		expect(fake.paused).toBeFalsy();
		expect(() => cancel()).not.toThrow();
	});

	it('seeks to trimStartMs (ms -> s) on play', () => {
		const fake = new FakeMediaElement();
		fake.currentTime = 0;
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimStartMs: 2500 });
		firePlay(fake);
		expect(fake.currentTime).toBe(2.5);
	});

	it('does not seek backwards past an already-later currentTime', () => {
		const fake = new FakeMediaElement();
		fake.currentTime = 10;
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimStartMs: 2500 });
		firePlay(fake);
		expect(fake.currentTime).toBe(10);
	});

	it('stops at duration - trimEndMs (distance from the tail), not at trimEndMs itself', async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.duration = 20; // known up front
		// trimEndMs=5000 means "stop 5s before the end" of a 20s clip: at 15s.
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimEndMs: 5000 });
		firePlay(fake);

		await vi.advanceTimersByTimeAsync(15_000);
		expect(fake.paused).toBeTruthy();
		expect(fake.currentTime).toBe(15);
	});

	it('waits for loadedmetadata to resolve the stop point when duration is not yet known', async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.duration = NaN;
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimEndMs: 5000 });
		firePlay(fake);

		// No duration yet: nothing should fire even after a long wait.
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fake.paused).toBeFalsy();

		fake.duration = 20;
		fake.dispatchEvent(new Event('loadedmetadata'));
		await vi.advanceTimersByTimeAsync(15_000);
		expect(fake.paused).toBeTruthy();
		expect(fake.currentTime).toBe(15);
	});

	it('ramps volume up from 0 on fade-in', async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.volume = 1;
		scheduleMediaTrimAndFade(asMediaElement(fake), { fadeInDuration: 1, volume: 0.8 });
		firePlay(fake);
		expect(fake.volume).toBe(0);

		await vi.advanceTimersByTimeAsync(1200);
		expect(fake.volume).toBeCloseTo(0.8, 5);
	});

	it('fades out before a configured trim end', async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.duration = 10;
		fake.volume = 1;
		// Stop at 10 - 2 = 8s; fade out over the last 1s (from 7s to 8s).
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimEndMs: 2000, fadeOutDuration: 1 });
		firePlay(fake);

		await vi.advanceTimersByTimeAsync(7000);
		expect(fake.volume).toBe(1);
		await vi.advanceTimersByTimeAsync(1200);
		expect(fake.volume).toBe(0);
		expect(fake.paused).toBeTruthy();
		expect(fake.currentTime).toBe(8);
	});

	it("fades out near the clip's own natural end when no trim end is set", async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.duration = 10;
		fake.volume = 1;
		scheduleMediaTrimAndFade(asMediaElement(fake), { fadeOutDuration: 2 });
		firePlay(fake);

		fake.currentTime = 8.5; // 1.5s left: inside the 2s fade window
		fake.dispatchEvent(new Event('timeupdate'));
		await vi.advanceTimersByTimeAsync(1600);
		expect(fake.volume).toBeCloseTo(0, 1);
	});

	it('cancel() removes the play listener and clears pending timers', async () => {
		vi.useFakeTimers();
		const fake = new FakeMediaElement();
		fake.duration = 20;
		const cancel = scheduleMediaTrimAndFade(asMediaElement(fake), { trimEndMs: 5000 });
		firePlay(fake);
		cancel();

		await vi.advanceTimersByTimeAsync(60_000);
		expect(fake.paused).toBeFalsy();
	});

	it('re-arms on a second play event (e.g. a loop restarting at 0)', () => {
		const fake = new FakeMediaElement();
		scheduleMediaTrimAndFade(asMediaElement(fake), { trimStartMs: 1000 });
		// A loop restarts the element at 0, which is before the trim start.
		fake.currentTime = 0;
		firePlay(fake);
		expect(fake.currentTime).toBe(1); // seeked forward to trim start

		fake.currentTime = 0;
		firePlay(fake);
		expect(fake.currentTime).toBe(1);
	});
});
