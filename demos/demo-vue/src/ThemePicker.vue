<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { themeKeys, themes } from './themes';

/**
 * Floating theme picker, ported from the React demo's `ThemePicker`.
 *
 * A fixed-position pill (bottom-right on desktop, top-right under the safe-area
 * on mobile) opens a menu of every theme. Teleported to <body> so it floats
 * above the viewer's own stacking contexts.
 */
const props = defineProps<{ current: string }>();
const emit = defineEmits<{ (e: 'change', key: string): void }>();

const open = ref(false);

// The picker is a fixed sibling of the viewer, so any z-index floats it above
// the viewer's whole subtree. On small screens we anchor it to the top-right
// (clear of the mobile bottom bar / bottom sheets) and keep the familiar
// bottom-right spot on desktop.
const isSmallScreen = ref(typeof window !== 'undefined' && window.innerWidth < 768);
function onResize(): void {
	isSmallScreen.value = window.innerWidth < 768;
}
onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

const preset = computed(() => themes[props.current] ?? themes.dark);
const bg = computed(() => preset.value.theme.colors?.card ?? '#111827');
const border = computed(() => preset.value.theme.colors?.border ?? '#374151');
const fg = computed(() => preset.value.theme.colors?.mutedForeground ?? '#9ca3af');
const primary = computed(() => preset.value.theme.colors?.primary ?? '#6366f1');

function pick(key: string): void {
	emit('change', key);
	open.value = false;
}
</script>

<template>
	<Teleport to="body">
		<div class="theme-picker" :class="{ 'theme-picker--small': isSmallScreen }">
			<button
				type="button"
				class="theme-picker__btn"
				title="Switch theme"
				:style="{ border: `1px solid ${border}`, background: bg, color: fg }"
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
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2" />
					<path d="M12 20v2" />
					<path d="m4.93 4.93 1.41 1.41" />
					<path d="m17.66 17.66 1.41 1.41" />
					<path d="M2 12h2" />
					<path d="M20 12h2" />
					<path d="m6.34 17.66-1.41 1.41" />
					<path d="m19.07 4.93-1.41 1.41" />
				</svg>
				{{ preset.label }}
			</button>
			<div
				v-if="open"
				class="theme-picker__menu"
				:style="{ background: bg, border: `1px solid ${border}` }"
			>
				<button
					v-for="key in themeKeys"
					:key="key"
					type="button"
					class="theme-picker__item"
					:style="{
						background: key === current ? `${primary}22` : 'transparent',
						color: key === current ? primary : fg,
						fontWeight: key === current ? 600 : 400,
					}"
					@click="pick(key)"
				>
					<span
						class="theme-picker__swatch"
						:style="{
							background: themes[key].theme.colors?.primary ?? '#6366f1',
							border: `2px solid ${themes[key].theme.colors?.border ?? '#374151'}`,
						}"
					/>
					{{ themes[key].label }}
				</button>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.theme-picker {
	position: fixed;
	bottom: 48px;
	right: 12px;
	z-index: 99999;
	font-family: system-ui, sans-serif;
}

.theme-picker--small {
	bottom: auto;
	right: 8px;
	top: calc(env(safe-area-inset-top, 0px) + 60px);
}

.theme-picker__btn {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border-radius: 9999px;
	cursor: pointer;
	font-size: 13px;
	font-weight: 500;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.theme-picker__menu {
	position: absolute;
	bottom: 100%;
	margin-bottom: 4px;
	right: 0;
	border-radius: 8px;
	overflow-y: auto;
	max-height: 60dvh;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	min-width: 150px;
}

/* On mobile the button is anchored near the top, so an upward menu was clipped
   off-screen. Open downward there; keep the bottom-anchored placement on desktop. */
.theme-picker--small .theme-picker__menu {
	bottom: auto;
	margin-bottom: 0;
	top: 100%;
	margin-top: 4px;
}

.theme-picker__item {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 8px 14px;
	border: none;
	cursor: pointer;
	font-size: 13px;
	text-align: left;
}

.theme-picker__swatch {
	width: 14px;
	height: 14px;
	border-radius: 9999px;
	flex-shrink: 0;
}
</style>
