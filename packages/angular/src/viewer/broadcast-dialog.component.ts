/**
 * broadcast-dialog.component.ts: Start / stop a one-way live broadcast.
 *
 * Selector: `pptx-broadcast-dialog`
 *
 * Angular port of the Vue `BroadcastDialog.vue`. A broadcast is a one-way
 * collaboration session: the presenter drives slide navigation and viewers
 * follow along via a shareable link. This dialog owns only the start/stop UI;
 * the host opens the collaboration session in response to `start` and supplies
 * the resolved `viewerUrl` while the broadcast is `active`.
 *
 * Composes {@link ModalDialogComponent}. Pure room-id / validation / link logic
 * lives in `./broadcast-helpers`.
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

import {
	buildBroadcastConfig,
	canStartBroadcast,
	canUseClipboard,
	seedBroadcastFields,
} from './broadcast-helpers';
import type { BroadcastConfig, BroadcastDefaults } from './broadcast-helpers';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-broadcast-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent],
	template: `
		<pptx-modal-dialog [open]="open()" [title]="dialogTitle()" (close)="onClose()">
			@if (active()) {
				<!-- Active: share the follow link + stop control -->
				<div class="pptx-ng-broadcast">
					<p class="pptx-ng-broadcast-desc">
						Your broadcast is live. Share this link so viewers can follow along.
					</p>

					<div class="pptx-ng-broadcast-field">
						<label for="pptx-ng-broadcast-viewer-url" class="pptx-ng-broadcast-label">
							Viewer link
						</label>
						<div class="pptx-ng-broadcast-link-row">
							<input
								id="pptx-ng-broadcast-viewer-url"
								class="pptx-ng-broadcast-input"
								type="text"
								readonly
								[value]="viewerUrl() ?? ''"
								(focus)="selectAll($event)"
							/>
							<button
								type="button"
								class="pptx-ng-broadcast-btn"
								[disabled]="!canCopy() || !viewerUrl()"
								(click)="onCopyLink()"
							>
								{{ copied() ? 'Copied' : 'Copy link' }}
							</button>
						</div>
						<p class="pptx-ng-broadcast-hint">Viewers opening this link will follow your slides.</p>
					</div>

					<button type="button" class="pptx-ng-broadcast-stop" (click)="onStop()">
						Stop broadcast
					</button>
				</div>
			} @else {
				<!-- Idle: configure + start a broadcast -->
				<div class="pptx-ng-broadcast">
					<p class="pptx-ng-broadcast-desc">
						Start a one-way broadcast. You drive the slides; viewers follow along from a shareable
						link.
					</p>

					<div class="pptx-ng-broadcast-field">
						<label for="pptx-ng-broadcast-room-id" class="pptx-ng-broadcast-label">Room ID</label>
						<input
							id="pptx-ng-broadcast-room-id"
							class="pptx-ng-broadcast-input"
							type="text"
							placeholder="broadcast-abc123"
							[value]="roomId()"
							(input)="roomId.set(asValue($event))"
						/>
					</div>

					<div class="pptx-ng-broadcast-field">
						<label for="pptx-ng-broadcast-server-url" class="pptx-ng-broadcast-label">
							Server URL
						</label>
						<input
							id="pptx-ng-broadcast-server-url"
							class="pptx-ng-broadcast-input"
							type="text"
							placeholder="ws://localhost:1234"
							[value]="serverUrl()"
							(input)="serverUrl.set(asValue($event))"
						/>
					</div>
				</div>
			}

			<div footer>
				<button type="button" class="pptx-ng-broadcast-btn" (click)="onClose()">Close</button>
				@if (!active()) {
					<button
						type="button"
						class="pptx-ng-broadcast-btn pptx-ng-broadcast-btn-primary"
						[disabled]="!canStart()"
						(click)="onStart()"
					>
						Start broadcast
					</button>
				}
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-broadcast {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-broadcast-desc {
				margin: 0;
				font-size: 0.8125rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-broadcast-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}

			.pptx-ng-broadcast-label {
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-broadcast-input {
				width: 100%;
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-background, #030712);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.8125rem;
			}

			.pptx-ng-broadcast-input:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
			}

			.pptx-ng-broadcast-link-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}

			.pptx-ng-broadcast-hint {
				margin: 0;
				font-size: 0.6875rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-broadcast-btn {
				padding: 0.375rem 0.75rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.375rem;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.75rem;
				cursor: pointer;
				white-space: nowrap;
				transition: background 0.15s ease;
			}

			.pptx-ng-broadcast-btn:hover:not(:disabled) {
				background: var(--pptx-border, #374151);
			}

			.pptx-ng-broadcast-btn:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			.pptx-ng-broadcast-btn-primary {
				border-color: var(--pptx-primary, #6366f1);
				background: var(--pptx-primary, #6366f1);
				color: #ffffff;
			}

			.pptx-ng-broadcast-btn-primary:hover:not(:disabled) {
				background: var(--pptx-primary, #6366f1);
				filter: brightness(1.1);
			}

			.pptx-ng-broadcast-stop {
				width: 100%;
				padding: 0.5rem 0.75rem;
				border: 1px solid rgba(239, 68, 68, 0.3);
				border-radius: 0.375rem;
				background: rgba(239, 68, 68, 0.1);
				color: #f87171;
				font-size: 0.75rem;
				font-weight: 500;
				cursor: pointer;
				transition: background 0.15s ease;
			}

			.pptx-ng-broadcast-stop:hover {
				background: rgba(239, 68, 68, 0.2);
			}
		`,
	],
})
export class BroadcastDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Optional `{ roomId, serverUrl }` seed for the start form. */
	readonly defaults = input<BroadcastDefaults>();

	/** Whether a broadcast is currently running. */
	readonly active = input<boolean>(false);

	/** The shareable follow link (shown while `active`). */
	readonly viewerUrl = input<string>();

	/** Fired when the presenter starts a broadcast. */
	readonly start = output<BroadcastConfig>();

	/** Fired when the presenter stops the active broadcast. */
	readonly stop = output<void>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	readonly roomId = signal('');
	readonly serverUrl = signal('');
	readonly copied = signal(false);

	readonly canStart = computed(() =>
		canStartBroadcast({ roomId: this.roomId(), serverUrl: this.serverUrl() }),
	);

	readonly dialogTitle = computed(() =>
		this.active() ? 'Broadcasting' : 'Broadcast to a live audience',
	);

	readonly canCopy = computed(() =>
		canUseClipboard(typeof navigator !== 'undefined' ? navigator : undefined),
	);

	constructor() {
		// Seed the form whenever the dialog opens for a fresh (non-active) broadcast.
		effect(() => {
			if (this.open() && !this.active()) {
				const fields = seedBroadcastFields(this.defaults());
				this.roomId.set(fields.roomId);
				this.serverUrl.set(fields.serverUrl);
				this.copied.set(false);
			}
		});
	}

	asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	selectAll(event: Event): void {
		(event.target as HTMLInputElement).select();
	}

	onClose(): void {
		this.close.emit();
	}

	onStart(): void {
		const config = buildBroadcastConfig({ roomId: this.roomId(), serverUrl: this.serverUrl() });
		if (config) {
			this.start.emit(config);
		}
	}

	onStop(): void {
		this.stop.emit();
	}

	onCopyLink(): void {
		const url = this.viewerUrl();
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
}
