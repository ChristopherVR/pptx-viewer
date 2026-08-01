/**
 * The presenter console's wall clock, elapsed timer and progress-bar reading.
 *
 * Lifted out of `PresenterView.vue` so the SFC holds no interval bookkeeping,
 * and so the 5-minute progress segment comes from shared
 * (`presenterTimerProgress`) instead of being re-derived per binding: the
 * segment length was inlined in React, re-derived in Vue and wrapped in a
 * helper in Angular, which is exactly how three consoles paced a talk slightly
 * differently.
 */
import { formatElapsed, formatTime, presenterTimerProgress } from 'pptx-viewer-shared';
import type { PresenterTimerProgress } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface PresenterClock {
	/** Current wall-clock time in ms, ticking once a second. */
	now: Ref<number>;
	/** Milliseconds since the show started (0 when it has not). */
	elapsed: ComputedRef<number>;
	/** `now` formatted for display. */
	clockText: ComputedRef<string>;
	/** `elapsed` formatted for display. */
	elapsedText: ComputedRef<string>;
	/** Progress-bar percent + zero-based segment for `elapsed`. */
	progress: ComputedRef<PresenterTimerProgress>;
}

export function usePresenterClock(startTime: () => number | null): PresenterClock {
	const now = ref(Date.now());
	let clockId: ReturnType<typeof setInterval> | null = null;

	onMounted(() => {
		clockId = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	});

	onBeforeUnmount(() => {
		if (clockId !== null) {
			clearInterval(clockId);
			clockId = null;
		}
	});

	const elapsed = computed(() => {
		const start = startTime();
		return start === null ? 0 : now.value - start;
	});

	return {
		now,
		elapsed,
		clockText: computed(() => formatTime(new Date(now.value))),
		elapsedText: computed(() => formatElapsed(elapsed.value)),
		progress: computed(() => presenterTimerProgress(elapsed.value)),
	};
}
