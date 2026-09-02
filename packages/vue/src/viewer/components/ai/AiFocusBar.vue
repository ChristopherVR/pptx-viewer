<script setup lang="ts">
/**
 * AiFocusBar: the strip under the panel header showing the assistant's current
 * focused targets as chips (live from the canvas selection, pinned, or picked).
 *
 * It also hosts the explicit "Point at a slide element" affordance: a crosshair
 * button that enters PICK MODE, after which the user clicks element(s) on the
 * canvas to hand them to the assistant (each pick is highlighted on the slide).
 * A one-click "Merge selected tables" directive still surfaces when the focus is
 * exactly two tables.
 */
import { Crosshair, GitMerge, Pin, PinOff, X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { focusTargetChips, isTwoTableFocus, mergeTablesDirective } from 'pptx-viewer-shared/ai';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

const props = defineProps<{
	targets: PptxAiFocusedTarget[];
	slides: PptxSlide[];
	isPinned: boolean;
	pickMode: boolean;
	hasPicks: boolean;
}>();

const emit = defineEmits<{
	(e: 'pin' | 'clear-pin' | 'start-pick' | 'stop-pick' | 'clear-picks'): void;
	(e: 'send-directive', text: string): void;
}>();

const { t } = useI18n();

const chips = computed(() => focusTargetChips(props.targets, props.slides));
const twoTables = computed(() => isTwoTableFocus(props.targets, props.slides));

/** Send the directive that fires `merge_tables` without a confirmation round-trip. */
function sendMerge(): void {
	const tt = twoTables.value;
	if (!tt) {
		return;
	}
	emit('send-directive', mergeTablesDirective(tt.slideIndex, tt.elementIdA, tt.elementIdB));
}
</script>

<template>
	<div class="border-b border-border bg-secondary/30">
		<div class="flex flex-wrap items-center gap-1 px-2.5 py-1.5">
			<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.ai.focusScope') }}
			</span>
			<span
				v-for="chip in chips"
				:key="chip.key"
				:class="
					cn(
						'inline-flex max-w-[10rem] items-center rounded-full px-2 py-0.5 text-[11px]',
						hasPicks || isPinned ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
					)
				"
				:title="chip.title"
			>
				<span class="truncate">{{ chip.label }}</span>
			</span>
			<span
				v-if="isPinned"
				class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
			>
				{{ t('pptx.ai.pinnedFocus') }}
			</span>
			<div class="ml-auto flex items-center gap-0.5">
				<button
					v-if="twoTables"
					type="button"
					class="inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
					@click="sendMerge"
				>
					<GitMerge class="w-3 h-3" />
					{{ t('pptx.ai.mergeSelectedTables') }}
				</button>
				<button
					type="button"
					:title="t('pptx.ai.pickElement')"
					:aria-label="t('pptx.ai.pickAria')"
					:aria-pressed="pickMode"
					:class="
						cn(
							'rounded-sm p-1',
							pickMode
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent',
						)
					"
					@click="pickMode ? emit('stop-pick') : emit('start-pick')"
				>
					<Crosshair class="w-3.5 h-3.5" />
				</button>
				<button
					v-if="hasPicks"
					type="button"
					:title="t('pptx.ai.pickClear')"
					:aria-label="t('pptx.ai.pickClear')"
					class="rounded-sm p-1 text-muted-foreground hover:bg-accent"
					@click="emit('clear-picks')"
				>
					<X class="w-3.5 h-3.5" />
				</button>
				<button
					v-else
					type="button"
					:title="isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')"
					:aria-label="isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')"
					class="rounded-sm p-1 text-muted-foreground hover:bg-accent"
					@click="isPinned ? emit('clear-pin') : emit('pin')"
				>
					<PinOff v-if="isPinned" class="w-3.5 h-3.5" />
					<Pin v-else class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
		<div
			v-if="pickMode"
			class="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-2.5 py-1"
		>
			<Crosshair class="w-3.5 h-3.5 shrink-0 animate-pulse text-primary" />
			<span class="text-[11px] font-medium text-primary">{{ t('pptx.ai.pickElementHint') }}</span>
			<button
				type="button"
				class="ml-auto rounded-sm bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
				@click="emit('stop-pick')"
			>
				{{ t('pptx.ai.pickDone') }}
			</button>
		</div>
	</div>
</template>
