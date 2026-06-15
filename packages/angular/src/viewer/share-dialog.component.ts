/**
 * share-dialog.component.ts — Start / stop a real-time collaboration session.
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

import type { CollaborationConfig } from '../internal/shared';
import { ModalDialogComponent } from './modal-dialog.component';
import { buildCollaborationConfig, canStartShare, seedShareFields } from './share-helpers';
import type { ShareDefaults } from './share-helpers';

@Component({
	selector: 'pptx-share-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="active() ? 'Collaboration active' : 'Share'"
			(close)="close.emit()"
		>
			@if (active()) {
				<div class="pptx-ng-share-active">
					<p class="pptx-ng-share-desc">A collaboration session is currently active.</p>
					<button type="button" class="pptx-ng-share-stop" (click)="handleStop()">
						Stop sharing
					</button>
				</div>
			} @else {
				<div class="pptx-ng-share-form">
					<p class="pptx-ng-share-desc">
						Start a real-time session and invite others to edit with you.
					</p>

					<div class="pptx-ng-share-field">
						<label for="pptx-ng-share-room" class="pptx-ng-share-label">Room ID</label>
						<input
							id="pptx-ng-share-room"
							type="text"
							class="pptx-ng-share-input"
							placeholder="my-presentation"
							[value]="roomId()"
							(input)="roomId.set(asValue($event))"
						/>
					</div>

					<div class="pptx-ng-share-field">
						<label for="pptx-ng-share-name" class="pptx-ng-share-label">Your name</label>
						<input
							id="pptx-ng-share-name"
							type="text"
							class="pptx-ng-share-input"
							placeholder="Jane Doe"
							[value]="userName()"
							(input)="userName.set(asValue($event))"
						/>
					</div>

					<div class="pptx-ng-share-field">
						<label for="pptx-ng-share-server" class="pptx-ng-share-label">Server URL</label>
						<input
							id="pptx-ng-share-server"
							type="text"
							class="pptx-ng-share-input"
							placeholder="wss://collab.example.com"
							[value]="serverUrl()"
							(input)="serverUrl.set(asValue($event))"
						/>
					</div>
				</div>
			}

			<div footer>
				<button type="button" class="pptx-ng-share-btn" (click)="close.emit()">
					{{ active() ? 'Close' : 'Cancel' }}
				</button>
				@if (!active()) {
					<button
						type="button"
						class="pptx-ng-share-btn pptx-ng-share-btn-primary"
						[disabled]="!canStart()"
						(click)="handleStart()"
					>
						Start sharing
					</button>
				}
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-share-form,
			.pptx-ng-share-active {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-share-desc {
				margin: 0;
				font-size: 0.8125rem;
				color: var(--pptx-muted-foreground, #9a9a9a);
			}

			.pptx-ng-share-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}

			.pptx-ng-share-label {
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-foreground, #e5e5e5);
			}

			.pptx-ng-share-input {
				width: 100%;
				padding: 0.375rem 0.75rem;
				border-radius: 0.375rem;
				border: 1px solid var(--pptx-border, #2a2a2a);
				background: var(--pptx-background, #111);
				color: var(--pptx-foreground, #e5e5e5);
				font-size: 0.8125rem;
			}

			.pptx-ng-share-input:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
				box-shadow: 0 0 0 1px var(--pptx-primary, #6366f1);
			}

			.pptx-ng-share-btn {
				padding: 0.375rem 0.75rem;
				border: none;
				border-radius: 0.375rem;
				background: var(--pptx-muted, #2a2a2a);
				color: var(--pptx-foreground, #e5e5e5);
				font-size: 0.75rem;
				cursor: pointer;
			}

			.pptx-ng-share-btn-primary {
				background: var(--pptx-primary, #6366f1);
				color: var(--pptx-primary-foreground, #fff);
			}

			.pptx-ng-share-btn-primary:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			.pptx-ng-share-stop {
				width: 100%;
				padding: 0.5rem 0.75rem;
				border: 1px solid rgba(239, 68, 68, 0.3);
				border-radius: 0.375rem;
				background: rgba(239, 68, 68, 0.1);
				color: #f87171;
				font-size: 0.75rem;
				font-weight: 500;
				cursor: pointer;
			}

			.pptx-ng-share-stop:hover {
				background: rgba(239, 68, 68, 0.2);
			}
		`,
	],
})
export class ShareDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Prefilled values for the form fields. */
	readonly defaults = input<ShareDefaults>();

	/** Whether a collaboration session is currently active. */
	readonly active = input<boolean>(false);

	/** Fired with the assembled config when the user starts sharing. */
	readonly start = output<CollaborationConfig>();

	/** Fired when the user stops an active session. */
	readonly stop = output<void>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	readonly roomId = signal('');
	readonly userName = signal('');
	readonly serverUrl = signal('');

	readonly canStart = computed(() =>
		canStartShare({
			roomId: this.roomId(),
			userName: this.userName(),
			serverUrl: this.serverUrl(),
		}),
	);

	constructor() {
		// Re-seed the form from defaults whenever the dialog (re)opens.
		effect(() => {
			if (this.open()) {
				const fields = seedShareFields(this.defaults());
				this.roomId.set(fields.roomId);
				this.userName.set(fields.userName);
				this.serverUrl.set(fields.serverUrl);
			}
		});
	}

	asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	handleStart(): void {
		const config = buildCollaborationConfig({
			roomId: this.roomId(),
			userName: this.userName(),
			serverUrl: this.serverUrl(),
		});
		if (config) {
			this.start.emit(config);
		}
	}

	handleStop(): void {
		this.stop.emit();
	}
}
