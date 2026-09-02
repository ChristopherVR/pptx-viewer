<script setup lang="ts">
/**
 * CompatibilityToasts: the bottom-right load-diagnostic stack for
 * `PptxCompatibilityWarning`s (unmodelled markup, an external image
 * reference, a chart workbook writeback that failed, and so on). Every
 * warning already flows through the shared `compatibilityWarningToasts`
 * decision function (`useCompatibilityToasts`); this component only renders
 * the list it returns.
 *
 * Unlike a transient toast, these do not auto-hide: they are diagnostics
 * about the LOADED document, so they persist until the user dismisses them
 * (or the next load resets the stack).
 */
import { AlertTriangle, Info, X } from 'lucide-vue-next';
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { compatToastStackStyle } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	toasts: CompatibilityWarningToast[];
	overflowCount: number;
}>();

const emit = defineEmits<{
	dismiss: [id: string];
	'dismiss-all': [];
}>();

const { t } = useI18n();
</script>

<template>
	<div
		v-if="props.toasts.length > 0"
		class="pptx-vue-compat-toasts max-w-[90vw]"
		data-testid="pptx-compat-toasts"
		:style="compatToastStackStyle()"
	>
		<div class="pointer-events-auto flex items-center justify-between">
			<span class="text-[11px] font-semibold text-muted-foreground">{{
				t('pptx.compatibility.toastTitle')
			}}</span>
			<button
				type="button"
				data-testid="pptx-compat-toasts-dismiss-all"
				class="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
				@click="emit('dismiss-all')"
			>
				{{ t('pptx.compatibility.dismissAll') }}
			</button>
		</div>

		<div
			v-for="toast in props.toasts"
			:key="toast.id"
			class="pptx-vue-compat-toast pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-popover p-2.5 text-xs shadow-lg"
			data-testid="pptx-compat-toast"
			:data-code="toast.code"
			:data-severity="toast.severity"
		>
			<AlertTriangle
				v-if="toast.severity === 'warning'"
				class="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
				aria-hidden="true"
			/>
			<Info v-else class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
			<p class="flex-1 text-foreground">{{ t(toast.messageKey, toast.params ?? {}) }}</p>
			<button
				type="button"
				data-testid="pptx-compat-toast-dismiss"
				:aria-label="t('pptx.compatibility.dismiss')"
				class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				@click="emit('dismiss', toast.id)"
			>
				<X class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</div>

		<p
			v-if="props.overflowCount > 0"
			class="pointer-events-auto text-center text-[11px] text-muted-foreground"
		>
			+{{ props.overflowCount }}
		</p>
	</div>
</template>
