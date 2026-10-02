import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { DialogFooterActionSpec } from './dialog-footer.component';
import { DialogFooterComponent } from './dialog-footer.component';

function formatMs(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

@Component({
	selector: 'pptx-rehearse-timings',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DialogFooterComponent, TranslatePipe],
	template: `
		@if (summary()) {
			<div
				class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
				role="dialog"
				aria-modal="true"
				[attr.aria-label]="'pptx.rehearse.summaryTitle' | translate"
			>
				<div
					class="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
				>
					<header class="border-b border-slate-200 px-5 py-4">
						<h2 class="font-semibold">{{ 'pptx.rehearse.summaryTitle' | translate }}</h2>
						<p class="mt-1 text-sm text-slate-600">
							{{ 'pptx.rehearse.totalPresentationTime' | translate }}:
							<span class="font-mono">{{ totalTime() }}</span>
						</p>
					</header>
					<div class="max-h-72 overflow-auto px-5 py-3">
						<table class="w-full text-sm">
							<thead>
								<tr>
									<th class="pb-2 text-left">#</th>
									<th class="pb-2 text-left">{{ 'pptx.rehearse.slide' | translate }}</th>
									<th class="pb-2 text-right">{{ 'pptx.rehearse.time' | translate }}</th>
								</tr>
							</thead>
							<tbody>
								@for (entry of entries(); track entry.index) {
									<tr class="border-t border-slate-200">
										<td class="py-2">{{ entry.index + 1 }}</td>
										<td class="py-2">
											{{ 'pptx.rehearse.slide' | translate }} {{ entry.index + 1 }}
										</td>
										<td class="py-2 text-right font-mono">{{ entry.time }}</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
					<footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
						<pptx-dialog-footer [actions]="footerActions()" (action)="onFooterAction($event)" />
					</footer>
				</div>
			</div>
		} @else {
			<div
				class="fixed bottom-4 left-4 z-[10000] flex items-center gap-3 rounded-lg bg-black/80 px-4 py-2 text-white shadow-xl"
				role="timer"
				aria-live="off"
			>
				<div>
					<small class="block text-slate-300">{{ 'pptx.rehearse.slideTime' | translate }}</small
					><span class="font-mono text-lg">{{ slideTime() }}</span>
				</div>
				<div class="h-8 w-px bg-white/30"></div>
				<div>
					<small class="block text-slate-300">{{ 'pptx.rehearse.totalTime' | translate }}</small
					><span class="font-mono text-lg">{{ totalElapsed() }}</span>
				</div>
				<button
					type="button"
					class="rounded p-2 hover:bg-white/20"
					(click)="togglePause.emit()"
					[attr.aria-label]="
						(paused() ? 'pptx.rehearse.resume' : 'pptx.rehearse.pause') | translate
					"
				>
					{{ paused() ? '▶' : 'Ⅱ' }}
				</button>
			</div>
		}
	`,
})
export class RehearseTimingsComponent {
	/** Footer actions for the shared `pptx-ui-dialog-footer`. */
	protected readonly footerActions = computed<DialogFooterActionSpec[]>(() => [
		{ id: 'discard', labelKey: 'pptx.rehearse.discard' },
		{ id: 'save', labelKey: 'pptx.rehearse.saveTimings', variant: 'primary' as const },
	]);

	protected onFooterAction(id: string): void {
		if (id === 'save') {
			this.save.emit();
		} else {
			this.discard.emit();
		}
	}

	readonly summary = input(false);
	readonly paused = input(false);
	readonly slideStartedAt = input<number | null>(null);
	readonly presentationStartedAt = input<number | null>(null);
	readonly timings = input<Record<number, number>>({});
	readonly togglePause = output<void>();
	readonly save = output<void>();
	readonly discard = output<void>();
	private readonly now = signal(Date.now());
	private timer = window.setInterval(() => this.now.set(Date.now()), 250);
	readonly slideTime = computed(() =>
		formatMs(this.slideStartedAt() ? this.now() - this.slideStartedAt()! : 0),
	);
	readonly totalElapsed = computed(() =>
		formatMs(this.presentationStartedAt() ? this.now() - this.presentationStartedAt()! : 0),
	);
	readonly entries = computed(() =>
		Object.entries(this.timings())
			.map(([index, ms]) => ({ index: Number(index), time: formatMs(ms) }))
			.sort((a, b) => a.index - b.index),
	);
	readonly totalTime = computed(() =>
		formatMs(Object.values(this.timings()).reduce((sum, ms) => sum + ms, 0)),
	);
	ngOnDestroy(): void {
		window.clearInterval(this.timer);
	}
}
