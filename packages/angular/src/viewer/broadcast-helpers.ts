/**
 * broadcast-helpers.ts: thin re-export of the shared Broadcast-dialog helpers.
 *
 * The pure logic (room-id generation, form validation, viewer-link building,
 * clipboard detection) now lives in `pptx-viewer-shared` and is consumed by all
 * three bindings. Angular imports it from the vendored `../internal/shared`
 * barrel; this file preserves the existing local import path for callers.
 */

export {
	DEFAULT_BROADCAST_SERVER_URL,
	buildBroadcastConfig,
	buildBroadcastViewerUrl,
	canStartBroadcast,
	canUseClipboard,
	generateBroadcastRoomId,
	seedBroadcastFields,
} from '../internal/shared';
export type { BroadcastConfig, BroadcastDefaults } from '../internal/shared';
