/**
 * version-history-panel.component.ts: Recovery-version side panel.
 *
 * Selector: `pptx-version-history-panel`
 *
 * Angular port of the React `VersionHistoryPanel` component
 * (`packages/react/src/viewer/components/VersionHistoryPanel.tsx`). A right-
 * docked side panel (not a modal) that reads autosaved recovery versions from
 * the same IndexedDB store used by autosave and lets the user restore or delete
 * them. The host owns `open` and `filePath`.
 */

import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { formatVersionTimestamp, formatRelativeTime } from '../internal/shared';
import { deleteVersion, formatFileSize, getVersions } from './version-history-helpers';
import type { RecoveryVersion } from './version-history-helpers';

@Component({
	selector: 'pptx-version-history-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (open()) {
			<div class="pptx-ng-versions">
				<div class="pptx-ng-versions-header">
					<span class="pptx-ng-versions-title">{{ 'pptx.versionHistory.title' | translate }}</span>
					<button type="button" class="pptx-ng-versions-close" (click)="close.emit()">
						&times;
					</button>
				</div>

				<div class="pptx-ng-versions-body">
					@if (loading()) {
						<div class="pptx-ng-versions-empty">
							{{ 'pptx.versionHistory.loading' | translate }}
						</div>
					} @else if (versions().length === 0) {
						<div class="pptx-ng-versions-empty">
							{{ 'pptx.versionHistory.noVersionsYet' | translate }}
						</div>
					} @else {
						@for (version of versions(); track version.key) {
							<div class="pptx-ng-versions-row">
								<div class="pptx-ng-versions-row-top">
									<span class="pptx-ng-versions-time">
										{{ formatTimestamp(version.timestamp) }}
									</span>
									<span class="pptx-ng-versions-rel">
										{{ formatRelative(version.timestamp) }}
									</span>
								</div>
								<div class="pptx-ng-versions-size">{{ formatSize(version.size) }}</div>
								<div class="pptx-ng-versions-actions">
									<button
										type="button"
										class="pptx-ng-versions-btn is-restore"
										[disabled]="restoringKey() === version.key"
										(click)="onRestore(version)"
									>
										{{
											restoringKey() === version.key
												? ('pptx.versionHistory.loading' | translate)
												: ('pptx.versionHistory.restore' | translate)
										}}
									</button>
									<button
										type="button"
										class="pptx-ng-versions-btn is-delete"
										[disabled]="deletingKey() === version.key"
										(click)="onDelete(version)"
									>
										{{ 'pptx.arrange.delete' | translate }}
									</button>
								</div>
							</div>
						}
					}
				</div>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-versions {
				position: absolute;
				inset-block: 0;
				right: 0;
				z-index: 50;
				display: flex;
				flex-direction: column;
				width: 20rem;
				background: var(--pptx-background, #030712);
				border-left: 1px solid var(--pptx-border, #374151);
				box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
			}

			.pptx-ng-versions-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}

			.pptx-ng-versions-title {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.875rem;
				font-weight: 500;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-versions-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				padding: 0;
				font-size: 1.125rem;
				line-height: 1;
				color: var(--pptx-muted-foreground, #9ca3af);
				background: transparent;
				border: none;
				border-radius: 0.25rem;
				cursor: pointer;
			}

			.pptx-ng-versions-close:hover {
				color: var(--pptx-foreground, #f3f4f6);
				background: var(--pptx-muted, #1f2937);
			}

			.pptx-ng-versions-body {
				flex: 1;
				overflow-y: auto;
			}

			.pptx-ng-versions-empty {
				padding: 2rem 0.75rem;
				text-align: center;
				font-size: 0.75rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-versions-row {
				padding: 0.625rem 0.75rem;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}

			.pptx-ng-versions-row:hover {
				background: var(--pptx-muted, rgba(31, 41, 55, 0.5));
			}

			.pptx-ng-versions-row-top {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.pptx-ng-versions-time {
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-versions-rel {
				font-size: 0.625rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-versions-size {
				margin-top: 0.125rem;
				font-size: 0.625rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-versions-actions {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				margin-top: 0.375rem;
			}

			.pptx-ng-versions-btn {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem 0.5rem;
				font-size: 0.625rem;
				border: none;
				border-radius: 0.25rem;
				cursor: pointer;
			}

			.pptx-ng-versions-btn:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			.pptx-ng-versions-btn.is-restore {
				color: var(--pptx-primary, #818cf8);
				background: rgba(99, 102, 241, 0.2);
			}

			.pptx-ng-versions-btn.is-restore:hover:not(:disabled) {
				background: rgba(99, 102, 241, 0.3);
			}

			.pptx-ng-versions-btn.is-delete {
				color: #f87171;
				background: rgba(220, 38, 38, 0.2);
			}

			.pptx-ng-versions-btn.is-delete:hover:not(:disabled) {
				background: rgba(220, 38, 38, 0.3);
			}
		`,
	],
})
export class VersionHistoryPanelComponent {
	/** Whether the side panel is visible. */
	readonly open = input<boolean>(false);

	/** The current file's key into the recovery store. */
	readonly filePath = input<string | undefined>(undefined);

	/** Fired when the panel is dismissed. */
	readonly close = output<void>();

	/** Fired with the restored version's bytes. */
	readonly restore = output<Uint8Array>();

	readonly versions = signal<RecoveryVersion[]>([]);
	readonly loading = signal(false);
	readonly restoringKey = signal<string | null>(null);
	readonly deletingKey = signal<string | null>(null);

	/** Template-facing bindings for the vendored shared formatters. */
	protected readonly formatTimestamp = formatVersionTimestamp;
	protected readonly formatRelative = formatRelativeTime;
	protected readonly formatSize = formatFileSize;

	constructor() {
		// Fetch (or refetch) whenever the panel opens or its file changes.
		effect(() => {
			if (this.open()) {
				void this.fetchVersions();
			}
		});
	}

	private async fetchVersions(): Promise<void> {
		const path = this.filePath();
		if (!path) {
			return;
		}
		this.loading.set(true);
		try {
			const result = await getVersions(path);
			this.versions.set(result);
		} catch {
			this.versions.set([]);
		} finally {
			this.loading.set(false);
		}
	}

	onRestore(version: RecoveryVersion): void {
		this.restoringKey.set(version.key);
		try {
			if (version.data) {
				this.restore.emit(version.data);
				this.close.emit();
			}
		} finally {
			this.restoringKey.set(null);
		}
	}

	onDelete(version: RecoveryVersion): void {
		this.deletingKey.set(version.key);
		void (async () => {
			try {
				await deleteVersion(version.key);
				await this.fetchVersions();
			} finally {
				this.deletingKey.set(null);
			}
		})();
	}
}
