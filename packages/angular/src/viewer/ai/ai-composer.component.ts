/**
 * AiComposerComponent: the message input row (auto-growing textarea + send /
 * stop button). Enter sends, Shift+Enter inserts a newline. Purely
 * presentational; mirrors React's `AiComposer`.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideSend, LucideSquare } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ai-composer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideSend, LucideSquare],
	template: `
		<div class="border-t border-border p-2">
			<div
				class="flex items-end gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-ring"
			>
				<textarea
					[value]="value()"
					(input)="value.set($any($event.target).value)"
					(keydown)="onKeyDown($event)"
					rows="1"
					[placeholder]="'pptx.ai.placeholder' | translate"
					[attr.aria-label]="'pptx.ai.placeholder' | translate"
					class="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
				></textarea>
				@if (isStreaming()) {
					<button
						type="button"
						(click)="onStop.emit()"
						[title]="'pptx.ai.stop' | translate"
						[attr.aria-label]="'pptx.ai.stop' | translate"
						class="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
					>
						<svg lucideSquare class="h-4 w-4"></svg>
					</button>
				} @else {
					<button
						type="button"
						(click)="submit()"
						[disabled]="value().trim().length === 0"
						[title]="'pptx.ai.send' | translate"
						[attr.aria-label]="'pptx.ai.send' | translate"
						[class]="
							value().trim().length === 0
								? 'shrink-0 rounded-sm p-1.5 transition-colors text-muted-foreground/50'
								: 'shrink-0 rounded-sm p-1.5 transition-colors bg-primary text-primary-foreground hover:bg-primary/90'
						"
					>
						<svg lucideSend class="h-4 w-4"></svg>
					</button>
				}
			</div>
		</div>
	`,
})
export class AiComposerComponent {
	readonly isStreaming = input<boolean>(false);
	readonly onSend = output<string>();
	readonly onStop = output<void>();

	protected readonly value = signal('');

	protected submit(): void {
		const trimmed = this.value().trim();
		if (trimmed.length === 0 || this.isStreaming()) {
			return;
		}
		this.onSend.emit(trimmed);
		this.value.set('');
	}

	protected onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.submit();
		}
	}
}
