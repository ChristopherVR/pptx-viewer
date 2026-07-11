import type { BroadcastConfig, CollaborationConfig } from 'pptx-viewer-shared';

/**
 * broadcast-helpers.ts: vanilla-local helpers for the Broadcast dialog.
 *
 * The framework-agnostic room-id / validation / viewer-link helpers already
 * live in `pptx-viewer-shared` (`packages/shared/src/render/broadcast-helpers.ts`)
 * and are re-exported below unchanged, mirroring the Angular binding's split
 * (`packages/angular/src/viewer/broadcast-helpers.ts`). The one vanilla-only
 * piece is {@link buildBroadcastSessionConfig}: turning the dialog's validated
 * `{ roomId, serverUrl, transport }` output into a full `CollaborationConfig`
 * with the one-way `role: 'owner'` (the presenter drives navigation; viewers
 * auto-follow), matching the Vue `useCollaborationWiring.onBroadcastStart`.
 */
export {
	DEFAULT_BROADCAST_SERVER_URL,
	buildBroadcastConfig,
	buildBroadcastViewerUrl,
	canStartBroadcast,
	canUseClipboard,
	generateBroadcastRoomId,
	resolveTransportForServerUrl,
	seedBroadcastFields,
} from 'pptx-viewer-shared';
export type { BroadcastConfig, BroadcastDefaults } from 'pptx-viewer-shared';

/** Presenter display name used when the host has not configured one. */
const DEFAULT_PRESENTER_NAME = 'Presenter';

/**
 * Turn a validated {@link BroadcastConfig} into a one-way broadcast session:
 * the presenter joins with `role: 'owner'` under `presenterName` (falling back
 * to {@link DEFAULT_PRESENTER_NAME} when blank).
 */
export function buildBroadcastSessionConfig(
	config: BroadcastConfig,
	presenterName: string | undefined,
): CollaborationConfig {
	return {
		...config,
		userName: presenterName?.trim() || DEFAULT_PRESENTER_NAME,
		role: 'owner',
	};
}
