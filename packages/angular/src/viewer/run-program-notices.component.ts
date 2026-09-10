/**
 * run-program-notices.component.ts: "Run program" notice stack for a running
 * slide show.
 *
 * Selector: `pptx-run-program-notices`
 *
 * PowerPoint's `ppaction://program` action ("Run program") cannot be launched
 * from a browser. Rather than doing nothing (silently) or blocking the show
 * with a modal dialog, `PresentationInputController`'s `runProgram` callback
 * (via {@link RunProgramNoticeStore}) surfaces a small, non-blocking notice
 * naming the exact command PowerPoint would have run, with a Copy button.
 *
 * Purely presentational, mirroring `CompatToastsComponent`'s card markup: the
 * store owns the notice list and this component only renders it and forwards
 * dismiss/copy clicks. See `presentation-overlay-chrome-styles.ts`'s
 * `RUN_PROGRAM_NOTICE_STACK_STYLE` doc comment for why this does not reuse
 * shared's `compatToastStackStyle` for positioning.
 *
 * @module viewer/run-program-notices
 */
import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { canUseClipboard } from '../internal/shared';
import type { RunProgramNotice } from '../internal/shared';
import { RUN_PROGRAM_NOTICE_STACK_STYLE } from './presentation-overlay-chrome-styles';

@Component({
	selector: 'pptx-run-program-notices',
	standalone: true,
	imports: [NgStyle, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (notices().length > 0) {
			<div
				class="pptx-ng-run-program-notices"
				data-testid="pptx-run-program-notices"
				[ngStyle]="stackStyle"
			>
				@for (notice of notices(); track notice.id) {
					<div
						class="pptx-ng-run-program-notice"
						data-testid="pptx-run-program-notice"
						[attr.data-target]="notice.target"
						role="status"
						style="pointer-events:auto"
					>
						<p class="pptx-ng-run-program-notice__message">
							{{ notice.messageKey | translate: { target: notice.target } }}
						</p>
						<div class="pptx-ng-run-program-notice__actions">
							@if (clipboardAvailable) {
								<button
									type="button"
									data-testid="pptx-run-program-notice-copy"
									class="pptx-ng-run-program-notice__button"
									(click)="copy(notice.target)"
								>
									{{ notice.copyLabelKey | translate }}
								</button>
							}
							<button
								type="button"
								data-testid="pptx-run-program-notice-dismiss"
								class="pptx-ng-run-program-notice__button"
								[attr.aria-label]="'pptx.compatibility.dismiss' | translate"
								(click)="dismiss.emit(notice.id)"
							>
								&times;
							</button>
						</div>
					</div>
				}
			</div>
		}
	`,
	styles: `
		.pptx-ng-run-program-notice {
			border-radius: 4px;
			border: 1px solid rgba(255, 255, 255, 0.2);
			background: rgba(0, 0, 0, 0.75);
			color: #fff;
			padding: 8px 10px;
			font-size: 12px;
			line-height: 1.4;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
		}
		.pptx-ng-run-program-notice__message {
			margin: 0 0 6px;
			overflow-wrap: anywhere;
		}
		.pptx-ng-run-program-notice__actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
		}
		.pptx-ng-run-program-notice__button {
			background: transparent;
			border: 1px solid rgba(255, 255, 255, 0.35);
			border-radius: 3px;
			color: inherit;
			font-size: 11px;
			padding: 2px 8px;
			cursor: pointer;
		}
		.pptx-ng-run-program-notice__button:hover {
			background: rgba(255, 255, 255, 0.12);
		}
	`,
})
export class RunProgramNoticesComponent {
	/** The notice list ({@link RunProgramNoticeStore.notices}). */
	readonly notices = input.required<readonly RunProgramNotice[]>();
	/** Dismiss one notice by id. */
	readonly dismiss = output<string>();

	/** See {@link RUN_PROGRAM_NOTICE_STACK_STYLE}'s doc comment. */
	protected readonly stackStyle = RUN_PROGRAM_NOTICE_STACK_STYLE;

	/**
	 * Whether an async clipboard write is available, checked once: a runtime's
	 * clipboard support does not change over the component's lifetime. False
	 * hides the Copy button entirely rather than rendering a button that would
	 * no-op on click.
	 */
	protected readonly clipboardAvailable = canUseClipboard(
		typeof navigator === 'undefined' ? undefined : navigator,
	);

	/** Copy a notice's resolved command to the clipboard. No-ops on failure. */
	protected copy(target: string): void {
		if (!this.clipboardAvailable) {
			return;
		}
		navigator.clipboard.writeText(target).catch(() => undefined);
	}
}
