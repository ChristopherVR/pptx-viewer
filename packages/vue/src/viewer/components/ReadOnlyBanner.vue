<script setup lang="ts">
/**
 * ReadOnlyBanner: shown above the canvas when the loaded deck recommends
 * opening read-only (`p:modifyVerifier` or "Mark as Final"). A thin adapter
 * around the shared `pptx-ui-read-only-banner`: the element owns the markup, the
 * password form and its focus; this maps props onto its state and re-emits its
 * typed intents. The recommendation itself is a pure shared decision
 * (`readOnlyRecommendation`, `pptx-viewer-shared`) computed by
 * `useReadOnlyRecommendation`.
 *
 * When `passwordPromptOpen` is set (a `modifyVerifier` with a hash this
 * viewer can check), "Edit anyway" is replaced by an inline password form
 * instead of the two action buttons: PowerPoint's own "read-only
 * recommended" prompt keeps the deck locked until the correct password is
 * entered, and a wrong one leaves it locked.
 */
import type { ReadOnlyBannerRequestEvent, ReadOnlyRecommendationKind } from 'pptx-viewer-shared';
import { computed } from 'vue';
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

const state = computed(() => ({
	kind: props.kind,
	messageKey: props.messageKey,
	passwordPromptOpen: props.passwordPromptOpen,
	passwordError: props.passwordError,
	checkingPassword: props.checkingPassword,
	translate: t,
}));

function request(event: Event): void {
	const intent = (event as ReadOnlyBannerRequestEvent).detail;
	switch (intent.id) {
		case 'editAnyway':
			emit('edit-anyway');
			break;
		case 'dismiss':
			emit('dismiss');
			break;
		case 'cancelPassword':
			emit('cancel-password');
			break;
		case 'submitPassword':
			emit('submit-password', intent.password);
	}
}
</script>

<template>
	<pptx-ui-read-only-banner v-if="props.kind" :state.prop="state" @read-only-request="request" />
</template>
