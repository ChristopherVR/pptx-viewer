/**
 * state-equality.ts: no-op-write guards for the viewer's hot state paths.
 *
 * Every binding keys its reactivity on identity: React compares the state
 * object, Vue triggers on a `ref` assignment, Angular signals notify on
 * `Object.is` mismatch, Svelte invalidates a `$state` assignment, and Vanilla
 * repaints imperatively on each call. So a write that carries NO new
 * information still costs a full render everywhere, and the cost is paid five
 * times over because the write usually originates in shared code.
 *
 * Issue #145 was one instance of that shape: a presenter-console tick that
 * changed nothing still allocated a fresh snapshot (and bumped `sequence`), so
 * nothing downstream could bail out. The helpers here let the shared producers
 * answer "did this actually change?" once, rather than each binding trying to
 * memoise around a value that is new by construction.
 *
 * These are deliberately field-by-field rather than a generic deep-equal: the
 * hot paths run per pointer move and per animation frame, so the comparison has
 * to be cheaper than the render it prevents, and a generic walk over unknown
 * nested data is not.
 */
import type { SanitizedPresence } from './collaboration-presence';
import type {
	PresentationPointerState,
	PresentationSnapshot,
	PresentationZoomState,
} from './presentation-session-types';

function zoomEqual(
	a: PresentationZoomState | undefined,
	b: PresentationZoomState | undefined,
): boolean {
	if (a === b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	return a.scale === b.scale && a.originX === b.originX && a.originY === b.originY;
}

function pointerEqual(
	a: PresentationPointerState | undefined,
	b: PresentationPointerState | undefined,
): boolean {
	if (a === b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	return a.tool === b.tool && a.x === b.x && a.y === b.y && a.color === b.color;
}

/**
 * Whether two presentation snapshots convey the same state.
 *
 * `sequence` is deliberately EXCLUDED. It is a monotonic change counter that is
 * bumped by construction on every merge, so including it would make every
 * snapshot unequal to every other and defeat the entire guard. Nothing compares
 * sequences for ordering; the audience-side validator only type-checks it.
 *
 * `inkStrokes` is compared by reference on purpose. The shared ink helpers are
 * copy-on-write (`appendPresentationInkPoint` returns a new array), so identity
 * is an exact change signal, and a deep walk would run per pointer move while a
 * presenter is drawing, which is the one place we can least afford it.
 */
export function presentationSnapshotsEqual(
	a: PresentationSnapshot,
	b: PresentationSnapshot,
): boolean {
	if (a === b) {
		return true;
	}
	return (
		a.slideIndex === b.slideIndex &&
		a.buildStep === b.buildStep &&
		a.blackout === b.blackout &&
		a.paused === b.paused &&
		a.elapsedMs === b.elapsedMs &&
		a.caption === b.caption &&
		a.subtitlesVisible === b.subtitlesVisible &&
		a.inkMarkupVisible === b.inkMarkupVisible &&
		a.inkStrokes === b.inkStrokes &&
		zoomEqual(a.zoom, b.zoom) &&
		pointerEqual(a.pointer, b.pointer)
	);
}

/**
 * Whether two sanitised presence entries describe the same collaborator in the
 * same place.
 *
 * `lastUpdated` is deliberately EXCLUDED, and that exclusion is the whole point:
 * every peer re-stamps it on each heartbeat, so comparing it would mean an
 * idle room still re-rendered every client on a fixed interval forever. Dropping
 * it does not weaken staleness handling, because a peer that genuinely goes
 * stale is removed from the list by `derivePresenceList` and the resulting
 * length change is caught here.
 */
export function presenceEntriesEqual(a: SanitizedPresence, b: SanitizedPresence): boolean {
	if (a === b) {
		return true;
	}
	return (
		a.clientId === b.clientId &&
		a.userName === b.userName &&
		a.userColor === b.userColor &&
		a.userAvatar === b.userAvatar &&
		a.role === b.role &&
		a.activeSlideIndex === b.activeSlideIndex &&
		a.cursorX === b.cursorX &&
		a.cursorY === b.cursorY &&
		a.selectedElementId === b.selectedElementId
	);
}

/**
 * Whether two derived presence lists are interchangeable, so a binding can keep
 * its existing array (and skip the re-render) instead of adopting a fresh one.
 * Order is significant, which is safe because `derivePresenceList` walks the
 * awareness map in insertion order.
 */
export function presenceListsEqual(
	a: readonly SanitizedPresence[],
	b: readonly SanitizedPresence[],
): boolean {
	if (a === b) {
		return true;
	}
	if (a.length !== b.length) {
		return false;
	}
	return a.every((entry, index) => {
		const other = b[index];
		return other !== undefined && presenceEntriesEqual(entry, other);
	});
}
