/**
 * AiChatPanelComponent: the right-hand AI assistant pane. Angular port of
 * React's `AiChatPanel` + `AiConversation`, combined into one thin shell.
 *
 * It provides {@link AiChatService} at its own level (so the lazily loaded `ai`
 * SDK is scoped to the open panel), bootstraps the session from the host bridge
 * + config, and lays out the transcript, the staged-proposal review strip, an
 * error banner, and the composer. Mount it behind a `@defer` block so its (and
 * the SDK's) chunk loads only when the assistant is first opened.
 */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import { LucideLoaderCircle, LucideSparkles, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import type { PptxAiBridge, PptxAiConfig } from '../../internal/shared-ai';
import { deckIdFromBridge } from '../../internal/shared-ai';
import { AiChatService } from './ai-chat.service';
import { AiComposerComponent } from './ai-composer.component';
import { AiFocusBarComponent } from './ai-focus-bar.component';
import { AiHistoryMenuComponent } from './ai-history-menu.component';
import { AiHistoryService } from './ai-history.service';
import { AiMessageListComponent } from './ai-message-list.component';
import { AiPanelStore } from './ai-panel-store';
import { AiProposalCardComponent } from './ai-proposal-card.component';

@Component({
	selector: 'pptx-ai-chat-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [AiChatService, AiHistoryService],
	imports: [
		TranslatePipe,
		AiMessageListComponent,
		AiProposalCardComponent,
		AiComposerComponent,
		AiFocusBarComponent,
		AiHistoryMenuComponent,
		LucideSparkles,
		LucideX,
		LucideLoaderCircle,
		LucideTriangleAlert,
	],
	template: `
		<div
			data-pptx-ai-panel
			class="pptx-ng-ai-panel flex h-full w-80 flex-col border-l border-border bg-card shadow-xl"
			[style.width.px]="panelWidth()"
		>
			<div class="flex items-center gap-2 border-b border-border px-3 py-2">
				<svg lucideSparkles class="h-4 w-4 text-primary"></svg>
				<span class="text-sm font-semibold text-foreground">{{ 'pptx.ai.title' | translate }}</span>
				<button
					type="button"
					(click)="closed.emit()"
					[title]="'pptx.ai.close' | translate"
					[attr.aria-label]="'pptx.ai.close' | translate"
					class="ml-auto rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent"
				>
					<svg lucideX class="h-4 w-4"></svg>
				</button>
			</div>

			@switch (chat.state()) {
				@case ('checking') {
					<div
						class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
						role="status"
						aria-live="polite"
					>
						<svg lucideLoaderCircle class="h-5 w-5 animate-spin"></svg>
					</div>
				}
				@case ('ready') {
					<div class="relative flex min-h-0 flex-1 flex-col">
						<pptx-ai-history-menu [canClear]="chat.messages().length > 0" />

						<pptx-ai-focus-bar
							[slides]="bridge().getSlides()"
							(sendDirective)="chat.send($event)"
						/>

						<pptx-ai-message-list [messages]="chat.messages()" [isStreaming]="chat.isStreaming()" />

						@if (chat.error(); as err) {
							<div
								class="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive"
							>
								<svg lucideTriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0"></svg>
								<div class="min-w-0 flex-1">
									<div class="font-medium">{{ 'pptx.ai.errorPrefix' | translate }}</div>
									<div class="truncate text-[11px] opacity-80" [title]="err.message">
										{{ err.message }}
									</div>
								</div>
								<button
									type="button"
									(click)="chat.clearError()"
									class="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] underline-offset-2 hover:underline"
								>
									{{ 'pptx.ai.retry' | translate }}
								</button>
							</div>
						}

						@if (chat.proposals().length > 0) {
							<div
								class="max-h-[38%] space-y-2 overflow-y-auto border-t border-border bg-background px-3 py-2"
							>
								<div class="flex items-center justify-between">
									<span
										class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
									>
										{{ 'pptx.ai.pendingChanges' | translate: { count: chat.proposals().length } }}
									</span>
									@if (chat.proposals().length > 1) {
										<button
											type="button"
											(click)="acceptAllProposals()"
											class="rounded-sm bg-primary/90 px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
										>
											{{ 'pptx.ai.acceptAll' | translate }}
										</button>
									}
								</div>
								@for (proposal of chat.proposals(); track proposal.id) {
									<pptx-ai-proposal-card
										[proposal]="proposal"
										(accept)="applyProposal($event)"
										(reject)="chat.rejectProposal($event)"
									/>
								}
							</div>
						}

						<pptx-ai-composer
							[isStreaming]="chat.isStreaming()"
							[prefillText]="store.prefill().text"
							[prefillNonce]="store.prefill().nonce"
							(onSend)="chat.send($event)"
							(onStop)="chat.stop()"
						/>
					</div>
				}
				@default {
					<div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
						<svg lucideTriangleAlert class="h-6 w-6 text-muted-foreground"></svg>
						<p class="text-sm font-medium text-foreground">
							{{ 'pptx.ai.unavailableTitle' | translate }}
						</p>
						<p class="text-[12px] text-muted-foreground">
							{{ chat.initError()?.message ?? ('pptx.ai.unavailableHint' | translate) }}
						</p>
					</div>
				}
			}
		</div>
	`,
})
export class AiChatPanelComponent {
	readonly bridge = input.required<PptxAiBridge>();
	readonly config = input.required<PptxAiConfig>();
	readonly panelWidth = input<number | undefined>(undefined);
	readonly closed = output<void>();

	protected readonly chat = inject(AiChatService);
	/** Chat-history persistence + the "Chats" resume menu (panel-scoped). */
	protected readonly history = inject(AiHistoryService);
	/** Shared panel scope + on-canvas highlight store (provided by the viewer). */
	protected readonly store = inject(AiPanelStore);

	constructor() {
		// Live "AI as a collaborator" focus: as each tool runs, navigate to and
		// highlight the slide / element(s) it touches so the canvas mirrors the
		// assistant in real time (and colour edits tween while it is active).
		this.chat.setToolTargetHandler((target) => {
			if (target && target.slideIndex !== undefined) {
				this.bridge().goToSlide(target.slideIndex);
			}
			this.store.flashToolTarget(target);
		});

		// Applied-edit animation: when the AI apply path publishes a batch of changed
		// elements, reveal that slide and hand the batch to the canvas overlay so the
		// user watches the edit land (glide old->new, fade/scale in-out, glow). The
		// animator is viewer-scoped (on the store), so unsubscribe with this panel.
		const unsubscribe = this.store.changeAnimator.subscribe((batch) => {
			if (batch) {
				this.bridge().goToSlide(batch.slideIndex);
			}
			this.store.showChangeBatch(batch);
		});
		inject(DestroyRef).onDestroy(unsubscribe);

		// Bootstrap the session once the bridge + config inputs are bound. `init`
		// is idempotent, so re-runs (e.g. from an inline config object identity
		// change) do not tear the live session down.
		effect(() => {
			this.chat.init(this.bridge(), this.config());
		});

		// Chat history: bootstrap the per-deck controller once the session is
		// ready (both inits are idempotent), and debounce-save on every
		// transcript change.
		effect(() => {
			if (this.chat.state() !== 'ready') {
				return;
			}
			this.history.init({
				deckId: deckIdFromBridge(this.bridge()),
				getMessages: () => [...this.chat.messages()],
				setMessages: (messages) => this.chat.setMessages(messages),
			});
		});
		effect(() => {
			this.chat.messages();
			this.history.notifyMessagesChanged();
		});
	}

	/**
	 * Apply a suggestion, first enabling the canvas colour tween so the edit fades
	 * in rather than snapping (proposals apply outside the tool loop).
	 */
	protected applyProposal(id: string): void {
		this.store.flashToolTarget(null);
		this.chat.applyProposal(id);
	}

	protected acceptAllProposals(): void {
		this.store.flashToolTarget(null);
		this.chat.acceptAllProposals();
	}
}
