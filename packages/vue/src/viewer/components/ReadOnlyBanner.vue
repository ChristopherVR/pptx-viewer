<script setup lang="ts">
/**
 * ReadOnlyBanner: shown above the canvas when the loaded deck recommends
 * opening read-only (`p:modifyVerifier` or "Mark as Final"). Mirrors the
 * existing Protected View banner's look; the recommendation itself is a pure
 * shared decision (`readOnlyRecommendation`, `pptx-viewer-shared`) computed by
 * `useReadOnlyRecommendation`, this component only renders it.
 *
 * When `passwordPromptOpen` is set (a `modifyVerifier` with a hash this
 * viewer can check), "Edit anyway" is replaced by an inline password form
 * instead of the two action buttons: PowerPoint's own "read-only
 * recommended" prompt keeps the deck locked until the correct password is
 * entered, and a wrong one leaves it locked.
 */
import { Lock } from 'lucide-vue-next';
import type { ReadOnlyRecommendationKind } from 'pptx-viewer-shared';
import { ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
	defineProps<{
		kind: ReadOnlyRecommendationKind;
		messageKey: string;
		passwordPromptOpen?: boolean;
		passwordError?: 'wrong-password' | 'unsupported-algorithm' | null;
		checkingPassword?: boolean;
	}>(),
	{
		passwordPromptOpen: false,
		passwordError: null,
		checkingPassword: false,
	},
);

const emit = defineEmits<{
	'edit-anyway': [];
	dismiss: [];
	'submit-password': [password: string];
	'cancel-password': [];
}>();

const { t } = useI18n();
const password = ref('');
const inputId = useId();
const errorId = useId();

function onSubmit(): void {
	emit('submit-password', password.value);
}
</script>

<template>
	<div
		v-if="props.kind"
		class="pptx-vue-readonly-banner flex items-center gap-3 border-b border-amber-700/30 bg-amber-900/20 px-4 py-2"
		role="status"
		data-testid="pptx-readonly-banner"
		:data-kind="props.kind"
	>
		<Lock class="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
		<p class="flex-1 text-xs text-amber-200">
			<strong>{{ t('pptx.readOnly.bannerTitle') }}</strong
			>: {{ t(props.messageKey) }}
		</p>

		<form
			v-if="props.passwordPromptOpen"
			data-testid="pptx-readonly-password-form"
			class="flex shrink-0 items-center gap-2"
			@submit.prevent="onSubmit"
		>
			<label :for="inputId" class="sr-only">{{ t('pptx.readOnly.passwordLabel') }}</label>
			<input
				:id="inputId"
				v-model="password"
				data-testid="pptx-readonly-password-input"
				type="password"
				:disabled="props.checkingPassword"
				:placeholder="t('pptx.readOnly.passwordPlaceholder')"
				:aria-invalid="props.passwordError !== null"
				:aria-describedby="props.passwordError !== null ? errorId : undefined"
				class="rounded border border-amber-600/40 bg-black/20 px-2 py-1 text-xs text-amber-100"
			/>
			<button
				type="submit"
				data-testid="pptx-readonly-unlock"
				:disabled="props.checkingPassword"
				class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30 disabled:opacity-60"
			>
				{{ t('pptx.readOnly.unlock') }}
			</button>
			<button
				type="button"
				data-testid="pptx-readonly-password-cancel"
				class="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-200/80 transition-colors hover:bg-amber-700/20"
				@click="emit('cancel-password')"
			>
				{{ t('pptx.common.cancel') }}
			</button>
			<span
				v-if="props.passwordError !== null"
				:id="errorId"
				role="alert"
				data-testid="pptx-readonly-password-error"
				class="shrink-0 text-xs text-red-300"
			>
				{{
					t(
						props.passwordError === 'wrong-password'
							? 'pptx.readOnly.wrongPassword'
							: 'pptx.readOnly.unsupportedAlgorithm',
					)
				}}
			</span>
		</form>
		<template v-else>
			<button
				type="button"
				data-testid="pptx-readonly-edit-anyway"
				class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30"
				@click="emit('edit-anyway')"
			>
				{{ t('pptx.readOnly.editAnyway') }}
			</button>
			<button
				type="button"
				data-testid="pptx-readonly-dismiss"
				class="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-200/80 transition-colors hover:bg-amber-700/20"
				@click="emit('dismiss')"
			>
				{{ t('pptx.readOnly.dismiss') }}
			</button>
		</template>
	</div>
</template>
