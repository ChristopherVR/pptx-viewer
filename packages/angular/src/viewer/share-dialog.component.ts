/**
 * share-dialog.component.ts: Start / stop a real-time collaboration session.
 *
 * Selector: `pptx-share-dialog`
 *
 * Angular port of the Vue `ShareDialog.vue`. Configures and starts a
 * collaboration session (room id, display name, server URL), or stops an
 * active one. Field defaults are supplied by the host via `defaults`. When
 * `active` is `true` the form is replaced by a "Stop sharing" action.
 *
 * Composes {@link ModalDialogComponent}. Pure validation / config-assembly
 * logic lives in `./share-helpers`.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CollaborationConfig } from '../internal/shared';
import { buildCreateCollaborationConfig, buildJoinCollaborationConfig } from '../internal/shared';
import { canUseClipboard } from './broadcast-helpers';
import { ModalDialogComponent } from './modal-dialog.component';
import { seedShareFields } from './share-helpers';
import type { ShareDefaults } from './share-helpers';

@Component({
	selector: 'pptx-share-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, TranslatePipe],
	templateUrl: './share-dialog.component.html',
	styleUrl: './share-dialog.component.css',
})
export class ShareDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Prefilled values for the form fields. */
	readonly defaults = input<ShareDefaults>();

	/** Whether a collaboration session is currently active (provider constructed). */
	readonly active = input<boolean>(false);

	/** Whether the websocket has reported a `connected` status. */
	readonly connected = input<boolean>(false);

	/** Total connected participants (self + remote peers). */
	readonly userCount = input<number>(0);

	/** Shareable join link surfaced while the session is active. */
	readonly shareUrl = input<string>('');

	/** Whether the active session is peer-to-peer (serverless webrtc). */
	readonly p2p = input<boolean>(false);

	/** Fired with the assembled config when the user starts sharing. */
	readonly start = output<CollaborationConfig>();

	/** Fired when the user stops an active session. */
	readonly stop = output<void>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	readonly roomId = signal('');
	readonly userName = signal('');
	readonly serverUrl = signal('');
	readonly invitation = signal('');
	readonly mode = signal<'create' | 'join'>('create');
	readonly copied = signal(false);

	readonly pendingConfig = computed(() =>
		this.mode() === 'join'
			? buildJoinCollaborationConfig({
					invitation: this.invitation(),
					userName: this.userName(),
					serverUrl: this.serverUrl(),
				})
			: buildCreateCollaborationConfig({
					roomId: this.roomId(),
					userName: this.userName(),
					serverUrl: this.serverUrl(),
				}),
	);
	readonly canStart = computed(() => this.pendingConfig() !== null);

	/** Blank server URL selects the serverless peer-to-peer (webrtc) transport. */
	readonly isP2p = computed(() => this.serverUrl().trim().length === 0);

	readonly canCopy = computed(() =>
		canUseClipboard(typeof navigator !== 'undefined' ? navigator : undefined),
	);

	constructor() {
		// Re-seed the form from defaults whenever the dialog (re)opens.
		effect(() => {
			if (this.open()) {
				const fields = seedShareFields(this.defaults());
				this.roomId.set(fields.roomId);
				this.userName.set(fields.userName);
				this.serverUrl.set(fields.serverUrl);
				this.invitation.set('');
			}
		});
	}

	asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	selectAll(event: Event): void {
		(event.target as HTMLInputElement).select();
	}

	onCopyLink(): void {
		const url = this.shareUrl();
		if (!url || !this.canCopy()) {
			return;
		}
		void Promise.resolve(navigator.clipboard.writeText(url)).then(() => {
			this.copied.set(true);
			window.setTimeout(() => {
				this.copied.set(false);
			}, 2000);
			return undefined;
		});
	}

	handleStart(): void {
		const config = this.pendingConfig();
		if (config) {
			this.start.emit(config);
		}
	}

	handleStop(): void {
		this.stop.emit();
	}
}
