/**
 * AiMessageListComponent: scrollable transcript of user / assistant turns.
 * Assistant tool calls render as {@link AiToolCallCardComponent}s inline between
 * prose. Purely presentational; auto-scrolls to the newest message. Mirrors
 * React's `AiMessageList`.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	input,
	viewChild,
} from '@angular/core';
import { LucideBot, LucideSparkles, LucideUser } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { toRenderableParts } from '../../internal/shared-ai';
import type { PptxAiUIMessage, RenderablePart } from '../../internal/shared-ai';
import { AiToolCallCardComponent } from './ai-tool-call-card.component';

/** One rendered transcript row: a message flattened to its renderable parts. */
interface MessageRow {
	id: string;
	isUser: boolean;
	parts: RenderablePart[];
}

@Component({
	selector: 'pptx-ai-message-list',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, AiToolCallCardComponent, LucideSparkles, LucideBot, LucideUser],
	template: `
		@if (rows().length === 0) {
			<div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
				<svg lucideSparkles class="h-7 w-7 text-primary/70"></svg>
				<p class="text-sm font-medium text-foreground">{{ 'pptx.ai.emptyTitle' | translate }}</p>
				<p class="text-[12px] text-muted-foreground">{{ 'pptx.ai.emptyHint' | translate }}</p>
			</div>
		} @else {
			<div class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
				@for (row of rows(); track row.id) {
					<div class="flex gap-2">
						<div
							[class]="
								row.isUser
									? 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground'
									: 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary'
							"
							[attr.aria-label]="(row.isUser ? 'pptx.ai.you' : 'pptx.ai.assistant') | translate"
						>
							@if (row.isUser) {
								<svg lucideUser class="h-3.5 w-3.5"></svg>
							} @else {
								<svg lucideBot class="h-3.5 w-3.5"></svg>
							}
						</div>
						<div class="min-w-0 flex-1 space-y-1.5">
							@for (part of row.parts; track $index) {
								@if (part.kind === 'text') {
									<p
										class="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground"
									>
										{{ part.text }}
									</p>
								} @else {
									<pptx-ai-tool-call-card [part]="part" />
								}
							}
						</div>
					</div>
				}
				@if (isStreaming()) {
					<div class="flex items-center gap-2 pl-8 text-[12px] text-muted-foreground">
						<span class="inline-flex gap-1">
							<span
								class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]"
							></span>
							<span
								class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]"
							></span>
							<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"></span>
						</span>
						{{ 'pptx.ai.thinking' | translate }}
					</div>
				}
				<div #endRef></div>
			</div>
		}
	`,
})
export class AiMessageListComponent {
	readonly messages = input.required<readonly PptxAiUIMessage[]>();
	readonly isStreaming = input<boolean>(false);

	private readonly endRef = viewChild<ElementRef<HTMLDivElement>>('endRef');

	/** Flatten each message into renderable parts, dropping empty assistant turns. */
	protected readonly rows = computed<MessageRow[]>(() => {
		const out: MessageRow[] = [];
		for (const message of this.messages()) {
			const isUser = message.role === 'user';
			const parts = toRenderableParts(message);
			if (parts.length === 0 && !isUser) {
				continue;
			}
			out.push({ id: message.id, isUser, parts });
		}
		return out;
	});

	constructor() {
		// Auto-scroll to the newest message / streaming indicator.
		effect(() => {
			this.rows();
			this.isStreaming();
			this.endRef()?.nativeElement.scrollIntoView({ block: 'end' });
		});
	}
}
