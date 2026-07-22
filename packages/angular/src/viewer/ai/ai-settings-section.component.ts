/**
 * AiSettingsSectionComponent: the File > Options > AI pane (Angular port of
 * React's `SettingsAiTab`). A technical section that exports the full chat
 * history, including every tool call's input/output, as a downloadable JSON or
 * Markdown log for debugging. Rendered only when the host enables the `ai`
 * config. Reads from the same {@link createChatHistoryStore} the panel persists
 * to (default namespace).
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideBug, LucideDownload } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { createChatHistoryStore } from '../../internal/shared-ai';
import type { PptxAiChatStore } from '../../internal/shared-ai';
import { exportAiChatLogs } from './ai-log-export';
import type { AiLogFormat } from './ai-log-export';

@Component({
	selector: 'pptx-ai-settings-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideBug, LucideDownload],
	template: `
		<div class="space-y-4">
			<div class="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
				<svg lucideBug class="mt-0.5 h-4 w-4 shrink-0 text-primary"></svg>
				<div>
					<p class="text-sm font-medium text-foreground">
						{{ 'pptx.ai.settingsSectionTitle' | translate }}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{{ 'pptx.ai.exportLogsHint' | translate }}
					</p>
				</div>
			</div>

			<p class="text-xs text-muted-foreground">
				@if (chatCount() === null) {
					{{ 'pptx.ai.exportLogsCounting' | translate }}
				} @else {
					{{ 'pptx.ai.exportLogsStoredCount' | translate: { count: chatCount() } }}
				}
			</p>

			<label class="flex items-center gap-2 text-xs text-foreground">
				<input
					type="checkbox"
					[checked]="detailed()"
					(change)="detailed.set($any($event.target).checked)"
					class="h-3.5 w-3.5 rounded border-border"
				/>
				{{ 'pptx.ai.exportLogsDetailed' | translate }}
			</label>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					(click)="onExport('json')"
					[disabled]="busy()"
					class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
				>
					<svg lucideDownload class="h-3.5 w-3.5"></svg>
					{{ 'pptx.ai.exportLogsJson' | translate }}
				</button>
				<button
					type="button"
					(click)="onExport('markdown')"
					[disabled]="busy()"
					class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
				>
					<svg lucideDownload class="h-3.5 w-3.5"></svg>
					{{ 'pptx.ai.exportLogsMarkdown' | translate }}
				</button>
			</div>

			@if (doneCount() !== null) {
				<p class="text-xs text-muted-foreground" role="status">
					@if (doneCount()! > 0) {
						{{ 'pptx.ai.exportLogsDone' | translate: { count: doneCount() } }}
					} @else {
						{{ 'pptx.ai.noChatsToExport' | translate }}
					}
				</p>
			}
		</div>
	`,
})
export class AiSettingsSectionComponent {
	private readonly store: PptxAiChatStore = createChatHistoryStore();

	/** Number of stored chats (null while counting). */
	protected readonly chatCount = signal<number | null>(null);
	/** Include tool inputs/outputs in the export. */
	protected readonly detailed = signal(true);
	protected readonly busy = signal(false);
	/** Result of the last export, or null before any export runs. */
	protected readonly doneCount = signal<number | null>(null);

	constructor() {
		void this.store
			.listChats()
			.then((chats) => this.chatCount.set(chats.length))
			.catch(() => this.chatCount.set(0));
	}

	protected onExport(format: AiLogFormat): void {
		this.busy.set(true);
		this.doneCount.set(null);
		void exportAiChatLogs({ store: this.store, format, detailed: this.detailed() })
			.then((count) => this.doneCount.set(count))
			.catch(() => this.doneCount.set(0))
			.finally(() => this.busy.set(false));
	}
}
