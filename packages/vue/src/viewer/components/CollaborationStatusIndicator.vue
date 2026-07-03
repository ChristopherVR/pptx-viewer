<script setup lang="ts">
import type { ConnectionStatus } from 'pptx-viewer-shared';
/**
 * CollaborationStatusIndicator: a small status pill showing the WebSocket
 * connection state and connected-participant count. Presentational only: the
 * host (`PowerPointViewer.vue`) supplies the reactive `status` / `count` from
 * the collaboration composable and listens for `retry` in the error state.
 *
 * Mirrors the React `CollaborationStatusIndicator.tsx` contract.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	/** Current WebSocket connection status. */
	status: ConnectionStatus;
	/** Number of connected participants (including the local user). */
	connectedCount: number;
}>();

const { t } = useI18n();

const emit = defineEmits<{
	/** The user asked to retry after a connection error. */
	(e: 'retry'): void;
}>();

interface StatusStyle {
	dot: string;
	text: string;
	labelKey: string;
}

const STATUS_STYLES: Record<ConnectionStatus, StatusStyle> = {
	connected: {
		dot: 'bg-green-400',
		text: 'text-green-400',
		labelKey: 'pptx.collaboration.status.connected',
	},
	connecting: {
		dot: 'bg-yellow-400 animate-pulse',
		text: 'text-yellow-400',
		labelKey: 'pptx.collaboration.status.connecting',
	},
	disconnected: {
		dot: 'bg-gray-500',
		text: 'text-gray-500',
		labelKey: 'pptx.collaboration.status.disconnected',
	},
	error: { dot: 'bg-red-400', text: 'text-red-400', labelKey: 'pptx.collaboration.status.error' },
};

const style = computed<StatusStyle>(() => STATUS_STYLES[props.status]);

const text = computed<string>(() => {
	if (props.status === 'connected') {
		const count = props.connectedCount;
		return count === 1
			? t('pptx.collaboration.onePersonHere')
			: t('pptx.collaboration.peopleHere', { count });
	}
	return t(style.value.labelKey);
});

const ariaLabel = computed<string>(() =>
	t('pptx.collaboration.statusAriaLabel', {
		status: t(style.value.labelKey),
		count: props.connectedCount,
	}),
);
</script>

<template>
	<div
		class="pptx-vue-collab-status flex items-center gap-1.5"
		data-testid="collaboration-status"
		:aria-label="ariaLabel"
	>
		<span class="inline-block h-2 w-2 rounded-full" :class="style.dot" aria-hidden="true" />
		<span class="text-[10px]" :class="style.text">{{ text }}</span>
		<button
			v-if="props.status === 'error'"
			type="button"
			class="text-[10px] text-blue-400 underline underline-offset-2 transition-colors hover:text-blue-300"
			:aria-label="t('pptx.collaboration.retry')"
			@click="emit('retry')"
		>
			{{ t('pptx.collaboration.retry') }}
		</button>
	</div>
</template>
