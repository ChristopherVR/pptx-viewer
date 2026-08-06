/**
 * AiHistoryMenuComponent: the AI panel's chat-history affordance. Renders the
 * toolbar row ("Chats" toggle + new-chat / clear-chat icon buttons) and, when
 * open, the dropdown listing saved chats (newest first) with resume + delete,
 * a "New chat" action, and a caption making clear history lives in this
 * browser. All persistence lives in {@link AiHistoryService}; this component
 * only calls it. Mirrors the React binding's AiHistoryMenu / AiHistoryList.
 */
import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import {
	LucideHistory,
	LucideMessageSquare,
	LucideMessageSquarePlus,
	LucidePlus,
	LucideTrash2,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { AiHistoryService } from './ai-history.service';

@Component({
	selector: 'pptx-ai-history-menu',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		LucideHistory,
		LucideMessageSquare,
		LucideMessageSquarePlus,
		LucidePlus,
		LucideTrash2,
	],
	host: {
		class: 'relative block',
		'(document:mousedown)': 'onDocumentMouseDown($event)',
	},
	template: `
		<div class="flex items-center gap-1 border-b border-border px-2 py-1">
			<button
				type="button"
				(click)="history.toggleMenu()"
				class="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[12px] text-muted-foreground hover:bg-accent"
			>
				<svg lucideHistory class="h-3.5 w-3.5"></svg>
				{{ 'pptx.ai.chats' | translate }}
			</button>
			<div class="ml-auto flex items-center gap-0.5">
				<button
					type="button"
					(click)="history.newChat()"
					[title]="'pptx.ai.newChat' | translate"
					[attr.aria-label]="'pptx.ai.newChat' | translate"
					class="rounded-sm p-1 text-muted-foreground hover:bg-accent"
				>
					<svg lucideMessageSquarePlus class="h-3.5 w-3.5"></svg>
				</button>
				<button
					type="button"
					(click)="history.clearCurrent()"
					[title]="'pptx.ai.clearChat' | translate"
					[attr.aria-label]="'pptx.ai.clearChat' | translate"
					[disabled]="!canClear()"
					class="rounded-sm p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
				>
					<svg lucideTrash2 class="h-3.5 w-3.5"></svg>
				</button>
			</div>
		</div>

		@if (history.menuOpen()) {
			<div
				class="absolute right-2 top-9 z-40 w-64 rounded-md border border-border bg-popover shadow-xl"
			>
				<div class="flex items-center justify-between border-b border-border px-2.5 py-1.5">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						{{ 'pptx.ai.historyTitle' | translate }}
					</span>
					<button
						type="button"
						(click)="history.newChat(); history.menuOpen.set(false)"
						class="inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
					>
						<svg lucidePlus class="h-3 w-3"></svg>
						{{ 'pptx.ai.newChat' | translate }}
					</button>
				</div>

				@if (history.chats().length === 0) {
					<p class="px-3 py-4 text-center text-[12px] text-muted-foreground">
						{{ 'pptx.ai.historyEmpty' | translate }}
					</p>
				} @else {
					<ul class="max-h-64 overflow-y-auto py-1">
						@for (chat of history.chats(); track chat.id) {
							<li class="flex items-center gap-1 px-1">
								<button
									type="button"
									(click)="resume(chat.id)"
									[class]="
										'flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent' +
										(chat.id === history.activeChatId() ? ' bg-accent/60' : '')
									"
								>
									<svg
										lucideMessageSquare
										class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
									></svg>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[12px] font-medium text-foreground">
											{{ chat.title || ('pptx.ai.untitledChat' | translate) }}
										</span>
										<span class="block text-[10px] text-muted-foreground">
											{{ 'pptx.ai.messageCount' | translate: { count: chat.messageCount } }}
										</span>
									</span>
								</button>
								<button
									type="button"
									(click)="deleteChat(chat.id)"
									[title]="'pptx.ai.deleteChat' | translate"
									[attr.aria-label]="'pptx.ai.deleteChat' | translate"
									class="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								>
									<svg lucideTrash2 class="h-3.5 w-3.5"></svg>
								</button>
							</li>
						}
					</ul>
				}

				<p class="border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
					{{ 'pptx.ai.historyHint' | translate }}
				</p>
			</div>
		}
	`,
})
export class AiHistoryMenuComponent {
	/** Whether the clear-chat action is enabled (transcript non-empty). */
	readonly canClear = input(false);

	protected readonly history = inject(AiHistoryService);
	private readonly elementRef = inject(ElementRef<HTMLElement>);

	protected resume(id: string): void {
		void this.history.resumeChat(id);
		this.history.menuOpen.set(false);
	}

	protected deleteChat(id: string): void {
		void this.history.deleteChat(id);
	}

	/** Close the dropdown on any outside click. */
	protected onDocumentMouseDown(event: MouseEvent): void {
		if (!this.history.menuOpen()) {
			return;
		}
		const host = this.elementRef.nativeElement as HTMLElement;
		if (event.target instanceof Node && !host.contains(event.target)) {
			this.history.menuOpen.set(false);
		}
	}
}
