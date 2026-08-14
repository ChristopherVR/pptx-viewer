/**
 * Who asked for the deck that just finished loading, and what that means for a
 * room that already holds slides.
 *
 * Every binding brackets its content-load with an adoption check: when a load
 * lands while a collaboration session is up and the shared doc already has
 * slides, the ROOM wins and the freshly parsed deck is thrown away. That rule
 * exists for one case only - a late joiner whose bootstrap deck (the blank or
 * sample deck the host mounted the viewer with) finishes parsing after the
 * room's real slides arrived, which would otherwise clobber them with nothing
 * left to repair it, since the doc itself never changed.
 *
 * Applied to EVERY load it also swallows the deck a user deliberately opens
 * during a session. Joining a room and then opening a file left the viewer on
 * the room's blank starter deck: the file parsed, was committed, and was
 * immediately overwritten (reproduced in the vanilla demo - a 7-slide deck
 * opened in a room settled back to the room's 1 slide, and the bigger the file
 * the longer the window). Opening a file is an act of authorship, so it is
 * published to the room instead.
 *
 * @module render/collaboration-load-origin
 */

/**
 * Why a content load ran.
 *
 * - `bootstrap`: the deck the host handed the viewer at mount (`source`), or a
 *   session restore. Nobody chose it during the session.
 * - `user`: opened during the session - File > Open, a recent file, a dropped
 *   file, or a host calling the load API.
 */
export type CollabLoadOrigin = 'bootstrap' | 'user';

/**
 * Whether the room's slides should replace the deck that just loaded.
 *
 * @param origin - Why the load ran; defaults to `user`, the safer answer for a
 *   caller that has not been taught to say (it keeps the deck rather than
 *   silently dropping it).
 * @param roomSlideCount - How many slides the shared doc holds right now. An
 *   empty room means this client is the seeder and its deck stands either way.
 */
export function shouldRoomSlidesReplaceLoad(
	origin: CollabLoadOrigin | undefined,
	roomSlideCount: number,
): boolean {
	return (origin ?? 'user') === 'bootstrap' && roomSlideCount > 0;
}
