<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * PasswordProtectionDialog: set or remove a presentation open password. Vue
 * port of the React `PasswordProtectionDialog.tsx`. Like React, the password
 * itself is held in host state (encryption on save is not wired in either
 * binding); this dialog owns only the entry UI, strength meter, and validation.
 */
const props = defineProps<{
	open: boolean;
	isCurrentlyProtected: boolean;
}>();

const emit = defineEmits<{
	setPassword: [password: string];
	removePassword: [];
	close: [];
}>();

const { t } = useI18n();

const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const error = ref('');

watch(
	() => props.open,
	(open) => {
		if (open) {
			password.value = '';
			confirmPassword.value = '';
			showPassword.value = false;
			error.value = '';
		}
	},
);

/** Returns a strength score 0-4 for the current password. */
const strength = computed(() => {
	const value = password.value;
	if (!value) {
		return 0;
	}
	let score = 0;
	if (value.length >= 8) {
		score++;
	}
	if (value.length >= 12) {
		score++;
	}
	if (/[A-Z]/u.test(value) && /[a-z]/u.test(value)) {
		score++;
	}
	if (/\d/u.test(value)) {
		score++;
	}
	if (/[^A-Za-z0-9]/u.test(value)) {
		score++;
	}
	return Math.min(score, 4);
});

const strengthColors = [
	'bg-red-500',
	'bg-orange-500',
	'bg-yellow-500',
	'bg-lime-500',
	'bg-green-500',
];
const strengthLabels = computed(() => [
	t('pptx.password.strengthVeryWeak'),
	t('pptx.password.strengthWeak'),
	t('pptx.password.strengthFair'),
	t('pptx.password.strengthStrong'),
	t('pptx.password.strengthVeryStrong'),
]);
const strengthLabel = computed(() => (password.value ? strengthLabels.value[strength.value] : ''));

function onSubmit(): void {
	error.value = '';
	if (!password.value) {
		error.value = t('pptx.password.errorEnter');
		return;
	}
	if (password.value !== confirmPassword.value) {
		error.value = t('pptx.password.errorMismatch');
		return;
	}
	if (password.value.length < 4) {
		error.value = t('pptx.password.errorTooShort');
		return;
	}
	emit('setPassword', password.value);
	emit('close');
}

function onRemove(): void {
	emit('removePassword');
	emit('close');
}
</script>

<template>
	<ModalDialog :open="props.open" :title="t('pptx.password.title')" @close="emit('close')">
		<div class="space-y-4">
			<div
				v-if="props.isCurrentlyProtected"
				class="flex items-center gap-2 rounded-lg border border-green-700/40 bg-green-900/30 px-3 py-2"
			>
				<span class="text-xs text-green-300">{{ t('pptx.password.protectedNotice') }}</span>
			</div>

			<p class="text-xs text-muted-foreground">
				{{ t('pptx.password.description') }}
			</p>

			<div>
				<label class="mb-1 block text-xs text-foreground">{{ t('pptx.password.password') }}</label>
				<div class="relative">
					<input
						v-model="password"
						:type="showPassword ? 'text' : 'password'"
						class="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
						:placeholder="t('pptx.password.enterPassword')"
						@input="error = ''"
					/>
					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-muted-foreground hover:text-foreground"
						@click="showPassword = !showPassword"
					>
						{{ showPassword ? t('pptx.password.hide') : t('pptx.password.show') }}
					</button>
				</div>
			</div>

			<div v-if="password" class="space-y-1">
				<div class="flex gap-1">
					<div
						v-for="i in 5"
						:key="i"
						class="h-1 flex-1 rounded-full transition-colors"
						:class="i - 1 <= strength ? strengthColors[strength] : 'bg-accent'"
					/>
				</div>
				<p class="text-[11px] text-muted-foreground">{{ strengthLabel }}</p>
			</div>

			<div>
				<label class="mb-1 block text-xs text-foreground">{{
					t('pptx.password.confirmPassword')
				}}</label>
				<input
					v-model="confirmPassword"
					:type="showPassword ? 'text' : 'password'"
					class="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
					:placeholder="t('pptx.password.reenterPassword')"
					@input="error = ''"
				/>
			</div>

			<p v-if="error" class="text-xs text-red-400">{{ error }}</p>
		</div>

		<template #footer>
			<button
				v-if="props.isCurrentlyProtected"
				type="button"
				class="mr-auto text-xs text-red-400 transition-colors hover:text-red-300"
				@click="onRemove"
			>
				{{ t('pptx.password.removePassword') }}
			</button>
			<button
				type="button"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="emit('close')"
			>
				{{ t('pptx.share.cancel') }}
			</button>
			<button
				type="button"
				class="rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
				@click="onSubmit"
			>
				{{
					props.isCurrentlyProtected
						? t('pptx.password.updatePassword')
						: t('pptx.password.setPassword')
				}}
			</button>
		</template>
	</ModalDialog>
</template>
