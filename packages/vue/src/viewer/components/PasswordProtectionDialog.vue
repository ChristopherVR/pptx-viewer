<script setup lang="ts">
import { computed, ref, watch } from 'vue';

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
const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const strengthLabel = computed(() => (password.value ? strengthLabels[strength.value] : ''));

function onSubmit(): void {
	error.value = '';
	if (!password.value) {
		error.value = 'Enter a password.';
		return;
	}
	if (password.value !== confirmPassword.value) {
		error.value = 'Passwords do not match.';
		return;
	}
	if (password.value.length < 4) {
		error.value = 'Password must be at least 4 characters.';
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
	<ModalDialog :open="props.open" title="Protect Presentation" @close="emit('close')">
		<div class="space-y-4">
			<div
				v-if="props.isCurrentlyProtected"
				class="flex items-center gap-2 rounded-lg border border-green-700/40 bg-green-900/30 px-3 py-2"
			>
				<span class="text-xs text-green-300">This presentation is password-protected.</span>
			</div>

			<p class="text-xs text-muted-foreground">
				Set a password so only people who know it can open this presentation.
			</p>

			<div>
				<label class="mb-1 block text-xs text-foreground">Password</label>
				<div class="relative">
					<input
						v-model="password"
						:type="showPassword ? 'text' : 'password'"
						class="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
						placeholder="Enter password"
						@input="error = ''"
					/>
					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-muted-foreground hover:text-foreground"
						@click="showPassword = !showPassword"
					>
						{{ showPassword ? 'Hide' : 'Show' }}
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
				<label class="mb-1 block text-xs text-foreground">Confirm password</label>
				<input
					v-model="confirmPassword"
					:type="showPassword ? 'text' : 'password'"
					class="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
					placeholder="Re-enter password"
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
				Remove password
			</button>
			<button
				type="button"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="emit('close')"
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/80"
				@click="onSubmit"
			>
				{{ props.isCurrentlyProtected ? 'Update password' : 'Set password' }}
			</button>
		</template>
	</ModalDialog>
</template>
