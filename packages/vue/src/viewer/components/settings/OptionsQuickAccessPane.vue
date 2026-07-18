<script setup lang="ts">
/**
 * OptionsQuickAccessPane - Options > Quick Access Toolbar: PowerPoint's
 * dual-list command chooser with Add/Remove, reorder arrows, and Reset over
 * the shared command catalog. Vue counterpart of React's
 * `settings/OptionsQuickAccessPane.tsx`.
 */
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import type { ViewerOptions } from 'pptx-viewer-shared';
import {
	addQuickAccessCommand,
	availableQuickAccessCommands,
	moveQuickAccessCommand,
	QUICK_ACCESS_COMMAND_CATALOG,
	removeQuickAccessCommand,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	options: ViewerOptions;
	onQuickAccessCommandsChange: (commandIds: string[]) => void;
	onResetQuickAccess: () => void;
}>();

const { t } = useI18n();

const selectedAvailable = ref<string | null>(null);
const selectedCurrent = ref<string | null>(null);

const current = computed(() => props.options.quickAccess.commandIds);
const available = computed(() =>
	availableQuickAccessCommands(current.value).map((entry) => entry.id),
);

function labelFor(id: string): string {
	const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
	return command ? t(command.labelKey) : id;
}

function addSelected(): void {
	if (selectedAvailable.value) {
		props.onQuickAccessCommandsChange(
			addQuickAccessCommand(current.value, selectedAvailable.value),
		);
		selectedAvailable.value = null;
	}
}

function removeSelected(): void {
	if (selectedCurrent.value) {
		props.onQuickAccessCommandsChange(
			removeQuickAccessCommand(current.value, selectedCurrent.value),
		);
		selectedCurrent.value = null;
	}
}

function moveSelected(direction: 'up' | 'down'): void {
	if (selectedCurrent.value) {
		props.onQuickAccessCommandsChange(
			moveQuickAccessCommand(current.value, selectedCurrent.value, direction),
		);
	}
}
</script>

<template>
	<div class="pptx-vue-options-quick-access space-y-3">
		<div class="flex items-stretch gap-3">
			<div class="flex-1">
				<p class="mb-1 text-xs font-medium text-muted-foreground">
					{{ t('pptx.options.quickAccess.chooseCommands') }}
				</p>
				<div
					role="listbox"
					:aria-label="t('pptx.options.quickAccess.chooseCommands')"
					class="h-48 space-y-0.5 overflow-y-auto rounded border border-border/60 p-1"
				>
					<button
						v-for="id in available"
						:key="id"
						type="button"
						role="option"
						:aria-selected="selectedAvailable === id"
						class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors"
						:class="
							selectedAvailable === id
								? 'bg-primary/15 text-primary'
								: 'text-foreground hover:bg-accent'
						"
						@click="selectedAvailable = id"
					>
						{{ labelFor(id) }}
					</button>
				</div>
			</div>

			<div class="flex flex-col justify-center gap-2">
				<button
					type="button"
					:disabled="!selectedAvailable"
					class="rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
					@click="addSelected"
				>
					{{ t('pptx.options.quickAccess.add') }} &gt;&gt;
				</button>
				<button
					type="button"
					:disabled="!selectedCurrent"
					class="rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
					@click="removeSelected"
				>
					&lt;&lt; {{ t('pptx.options.quickAccess.remove') }}
				</button>
			</div>

			<div class="flex-1">
				<p class="mb-1 text-xs font-medium text-muted-foreground">
					{{ t('pptx.options.quickAccess.currentCommands') }}
				</p>
				<div
					role="listbox"
					:aria-label="t('pptx.options.quickAccess.currentCommands')"
					class="h-48 space-y-0.5 overflow-y-auto rounded border border-border/60 p-1"
				>
					<button
						v-for="id in current"
						:key="id"
						type="button"
						role="option"
						:aria-selected="selectedCurrent === id"
						class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors"
						:class="
							selectedCurrent === id
								? 'bg-primary/15 text-primary'
								: 'text-foreground hover:bg-accent'
						"
						@click="selectedCurrent = id"
					>
						{{ labelFor(id) }}
					</button>
				</div>
			</div>

			<div class="flex flex-col justify-center gap-2">
				<button
					type="button"
					:aria-label="t('pptx.options.quickAccess.moveUp')"
					:disabled="!selectedCurrent"
					class="rounded border border-border p-1.5 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
					@click="moveSelected('up')"
				>
					<ChevronUp class="h-4 w-4" />
				</button>
				<button
					type="button"
					:aria-label="t('pptx.options.quickAccess.moveDown')"
					:disabled="!selectedCurrent"
					class="rounded border border-border p-1.5 text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
					@click="moveSelected('down')"
				>
					<ChevronDown class="h-4 w-4" />
				</button>
			</div>
		</div>

		<button
			type="button"
			class="rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
			@click="onResetQuickAccess"
		>
			{{ t('pptx.options.quickAccess.reset') }}
		</button>
	</div>
</template>
