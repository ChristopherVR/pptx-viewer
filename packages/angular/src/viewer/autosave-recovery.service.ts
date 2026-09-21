/**
 * autosave-recovery.service.ts: offer a crash-recovery snapshot back to the
 * user.
 *
 * Angular wrote recovery snapshots and never looked for one again, so the
 * feature was invisible: a crashed tab reopened on the pre-crash deck with no
 * hint that newer work existed. The decision and the copy come from
 * `pptx-viewer-shared` (`render/autosave-recovery`); this service only owns the
 * Angular reactivity.
 *
 * Provide it once on the viewer component. The component wires its accessors
 * via {@link bind}; the resulting {@link prompt} signal feeds the dialog.
 */

import { DestroyRef, effect, inject, Injectable, Injector, signal } from '@angular/core';

import {
	acceptAutosaveRecovery,
	acknowledgeAutosaveRecovery,
	discardAutosaveRecovery,
	probeAutosaveRecovery,
	shouldProbeAutosaveRecovery,
} from '../internal/shared';
import type { AutosaveRecord, AutosaveRecoveryPrompt } from '../internal/shared';

/** Live host accessors the recovery probe reads (all reactive). */
export interface AutosaveRecoveryHost {
	/** IndexedDB key of the open deck. Nothing to look up without one. */
	readonly filePath: () => string | undefined;
	/** Public document name rendered in the recovery message. */
	readonly fileName: () => string | undefined;
	/** True while the load pipeline is running. */
	readonly loading: () => boolean;
	/** Load error, if any. */
	readonly error: () => string | null | undefined;
	/** Slides currently rendered. */
	readonly slideCount: () => number;
	/**
	 * Whether the host permits autosave at all (`autosave` input not `false`). A
	 * user who merely switched the toggle off is still offered a pre-crash
	 * snapshot; a host that forbade the feature is not.
	 */
	readonly autosaveAllowed: () => boolean;
	/** Load the recovered bytes into the viewer. */
	readonly restore: (bytes: Uint8Array) => void;
}

@Injectable()
export class AutosaveRecoveryService {
	private readonly injector = inject(Injector);
	private readonly destroyRef = inject(DestroyRef);

	/** What the dialog should say, or null when there is nothing to offer. */
	readonly prompt = signal<AutosaveRecoveryPrompt | null>(null);
	/** The destructive delete is still pending. */
	readonly discarding = signal(false);

	private host: AutosaveRecoveryHost | null = null;
	private record: AutosaveRecord | null = null;
	private checked = false;
	private destroyed = false;
	private actionPending = false;

	bind(host: AutosaveRecoveryHost): void {
		this.host = host;
		this.destroyRef.onDestroy(() => {
			this.destroyed = true;
		});
		effect(
			() => {
				const filePath = host.filePath();
				if (
					!shouldProbeAutosaveRecovery({
						alreadyChecked: this.checked,
						filePath,
						loading: host.loading(),
						error: host.error() ?? null,
						slideCount: host.slideCount(),
						autosaveAllowed: host.autosaveAllowed(),
					})
				) {
					return;
				}
				this.checked = true;
				void probeAutosaveRecovery(filePath as string, Date.now(), host.fileName()).then(
					(offer) => {
						if (offer && !this.destroyed) {
							this.record = offer.record;
							this.prompt.set(offer.prompt);
						}
						return offer;
					},
				);
			},
			{ injector: this.injector },
		);
	}

	/** The user accepted: load the snapshot bytes. */
	restore(): void {
		if (this.actionPending) {
			return;
		}
		this.actionPending = true;
		const found = this.record;
		this.prompt.set(null);
		this.record = null;
		if (found && this.host) {
			this.host.restore(acceptAutosaveRecovery(found));
			acknowledgeAutosaveRecovery(found);
		}
	}

	/** The user declined: drop the snapshot. */
	discard(): void {
		if (this.actionPending) {
			return;
		}
		const found = this.record;
		if (!found) {
			this.prompt.set(null);
			return;
		}
		this.actionPending = true;
		this.discarding.set(true);
		void (async () => {
			try {
				await discardAutosaveRecovery(found);
				this.record = null;
				this.prompt.set(null);
			} catch {
				// Leave the prompt open so a failed discard can be retried.
			} finally {
				this.actionPending = false;
				this.discarding.set(false);
			}
		})();
	}
}
