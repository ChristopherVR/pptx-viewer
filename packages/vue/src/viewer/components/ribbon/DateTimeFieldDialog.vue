<script setup lang="ts">
/**
 * DateTimeFieldDialog: Insert > Field > Date/Time. Native to the Vue binding
 * (a modal over the document), so it stays outside the shared Insert element.
 * Mounted only while open, so every opening starts from "now".
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ close: []; insert: [formatted: string] }>();
const { t } = useI18n();

const pad = (n: number): string => String(n).padStart(2, '0');
const now = new Date();
const value = ref(
	`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
);
const format = ref('locale');
const KINDS = ['locale', 'long', 'short', 'iso', 'time'];

const LONG: Intl.DateTimeFormatOptions = {
	weekday: 'long',
	year: 'numeric',
	month: 'long',
	day: 'numeric',
};
const SHORT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

function formatDate(date: Date, kind: string): string {
	switch (kind) {
		case 'iso':
			return date.toISOString().slice(0, 10);
		case 'long':
			return date.toLocaleDateString(undefined, LONG);
		case 'short':
			return date.toLocaleDateString(undefined, SHORT);
		case 'time':
			return date.toLocaleString();
		default:
			return date.toLocaleDateString();
	}
}

/** Preview strings for the format `<select>` options. */
function preview(kind: string): string {
	return formatDate(new Date(value.value || Date.now()), kind);
}

function confirm(): void {
	const date = new Date(value.value);
	if (!isNaN(date.getTime())) {
		emit('insert', formatDate(date, format.value));
	}
}

function onBackdropMouseDown(event: MouseEvent): void {
	if (event.target === event.currentTarget) {
		emit('close');
	}
}
</script>

<template>
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
		@mousedown="onBackdropMouseDown"
	>
		<div class="rounded-lg border border-border bg-popover shadow-2xl p-4 w-72 space-y-3">
			<div class="text-sm font-medium text-foreground">{{ t('pptx.field.dateTime') }}</div>
			<input
				type="datetime-local"
				class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
				:value="value"
				@input="value = ($event.target as HTMLInputElement).value"
			/>
			<div>
				<label class="block text-[11px] text-muted-foreground mb-1">{{
					t('pptx.field.format', 'Format')
				}}</label>
				<select
					class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
					:value="format"
					@change="format = ($event.target as HTMLSelectElement).value"
				>
					<option v-for="kind in KINDS" :key="kind" :value="kind">
						{{ preview(kind) }}
					</option>
				</select>
			</div>
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-muted transition-colors"
					@click="emit('close')"
				>
					{{ t('pptx.common.cancel', 'Cancel') }}
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
					@click="confirm"
				>
					{{ t('pptx.common.insert', 'Insert') }}
				</button>
			</div>
		</div>
	</div>
</template>
