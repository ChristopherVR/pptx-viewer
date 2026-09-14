import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How often a deferred history run re-checks whether the pointer interaction
 * that blocked it has ended. Roughly one frame: a click-away commit becomes
 * undoable before the user can reach for Ctrl+Z, and a multi-second drag costs
 * one boolean read per frame while a run is pending.
 */
const POLL_INTERVAL_MS = 16;

export interface PointerReleaseWakeup {
	/**
	 * Bumped once for every deferred run, after the blocking interaction has
	 * ended. Listing it as a dependency of the history tracking effect is what
	 * re-runs that effect.
	 */
	pointerReleaseNonce: number;
	/**
	 * Call when the tracking effect skipped a run because
	 * `hasActivePointerInteraction()` was true. Idempotent while a re-check is
	 * already scheduled.
	 */
	deferUntilPointerReleased: () => void;
}

/**
 * Re-runs the history tracking effect after a pointer interaction ends.
 *
 * The effect defers while a drag / resize / marquee / adjust / drawing gesture
 * is in flight so that a gesture lands as ONE undo entry, and it relied on
 * `pointerCommitNonce` to re-run it afterwards. That nonce is only bumped by a
 * pointer-up that actually MOVED something. The canvas pointerdown handlers,
 * however, commit an in-progress inline text edit and then arm the marquee /
 * drag refs inside the same event, so by the time React runs the effect the
 * gesture is already active and the run is skipped. A plain click-away never
 * moves, so nothing ever re-ran the effect: the committed text stayed outside
 * the undo stack until the next edit's snapshot swallowed it, and one Undo
 * reverted two changes.
 *
 * The hook owns the wake-up rather than the pointer-up handlers because the
 * effect is the one that decided to defer: any arming path, present or future,
 * is covered without each having to remember to signal.
 */
export function usePointerReleaseWakeup(
	hasActivePointerInteraction: () => boolean,
): PointerReleaseWakeup {
	const [pointerReleaseNonce, setPointerReleaseNonce] = useState(0);
	const gateRef = useRef(hasActivePointerInteraction);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		gateRef.current = hasActivePointerInteraction;
	}, [hasActivePointerInteraction]);

	const deferUntilPointerReleased = useCallback(() => {
		if (timerRef.current !== null) {
			return;
		}
		const poll = (): void => {
			if (gateRef.current()) {
				timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
				return;
			}
			timerRef.current = null;
			setPointerReleaseNonce((previous) => previous + 1);
		};
		timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
	}, []);

	return { pointerReleaseNonce, deferUntilPointerReleased };
}
