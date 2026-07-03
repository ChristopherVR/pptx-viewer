<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { LanguageCode } from './languages';
import { languages } from './languages';

/**
 * Floating language picker, styled to match `ThemePicker.vue`.
 *
 * Stacked directly above the theme picker (same fixed corner) rather than
 * beside it, so the two never collide regardless of how wide either button's
 * label happens to be.
 */
const props = defineProps<{ current: LanguageCode }>();
const emit = defineEmits<{ (e: 'change', code: LanguageCode): void }>();

const open = ref(false);

const isSmallScreen = ref(typeof window !== 'undefined' && window.innerWidth < 768);
function onResize(): void {
	isSmallScreen.value = window.innerWidth < 768;
}
onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

function activeLabel(code: LanguageCode): string {
	return (languages.find((language) => language.code === code) ?? languages[0]).label;
}

function pick(code: LanguageCode): void {
	emit('change', code);
	open.value = false;
}
</script>

<template>
	<Teleport to="body">
		<div class="language-picker" :class="{ 'language-picker--small': isSmallScreen }">
			<button
				type="button"
				class="language-picker__btn"
				title="Switch language"
				@click="open = !open"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M2 12h20" />
					<path
						d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"
					/>
				</svg>
				{{ activeLabel(props.current) }}
			</button>
			<div v-if="open" class="language-picker__menu">
				<button
					v-for="language in languages"
					:key="language.code"
					type="button"
					class="language-picker__item"
					:class="{ 'language-picker__item--active': language.code === current }"
					@click="pick(language.code)"
				>
					{{ language.label }}
				</button>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.language-picker {
	position: fixed;
	bottom: 92px;
	right: 12px;
	z-index: 99999;
	font-family: system-ui, sans-serif;
}

.language-picker--small {
	bottom: auto;
	right: 8px;
	top: calc(env(safe-area-inset-top, 0px) + 104px);
}

.language-picker__btn {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border-radius: 9999px;
	border: 1px solid #374151;
	background: #111827;
	color: #9ca3af;
	cursor: pointer;
	font-size: 13px;
	font-weight: 500;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.language-picker__menu {
	position: absolute;
	bottom: 100%;
	margin-bottom: 4px;
	right: 0;
	background: #111827;
	border: 1px solid #374151;
	border-radius: 8px;
	overflow-y: auto;
	max-height: 60dvh;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	min-width: 150px;
}

.language-picker--small .language-picker__menu {
	bottom: auto;
	margin-bottom: 0;
	top: 100%;
	margin-top: 4px;
}

.language-picker__item {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 8px 14px;
	border: none;
	background: transparent;
	color: #9ca3af;
	cursor: pointer;
	font-size: 13px;
	text-align: left;
}

.language-picker__item--active {
	background: #6366f122;
	color: #6366f1;
	font-weight: 600;
}
</style>
