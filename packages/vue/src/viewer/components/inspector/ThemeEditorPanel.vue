<script setup lang="ts">
/**
 * ThemeEditorPanel: Design ▸ Edit theme. A right-side panel for editing the
 * presentation theme: the 12 scheme colours, the major/minor fonts, and the
 * theme name. "Apply to Presentation" re-themes the deck via the host's
 * `applyThemeToData` path. A compact single-component port of React's
 * `ThemeEditorPanel` + `ThemeColorSchemeEditor`.
 */
import type { PptxTheme, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ theme: PptxTheme | undefined; canEdit: boolean }>();

const emit = defineEmits<{
	apply: [
		payload: { colorScheme: PptxThemeColorScheme; fontScheme: PptxThemeFontScheme; name: string },
	];
	close: [];
}>();

const { t } = useI18n();

const COLOR_SLOTS: ReadonlyArray<{ key: keyof PptxThemeColorScheme; labelKey: string }> = [
	{ key: 'dk1', labelKey: 'pptx.themeEditor.colorDark1' },
	{ key: 'lt1', labelKey: 'pptx.themeEditor.colorLight1' },
	{ key: 'dk2', labelKey: 'pptx.themeEditor.colorDark2' },
	{ key: 'lt2', labelKey: 'pptx.themeEditor.colorLight2' },
	{ key: 'accent1', labelKey: 'pptx.themeEditor.colorAccent1' },
	{ key: 'accent2', labelKey: 'pptx.themeEditor.colorAccent2' },
	{ key: 'accent3', labelKey: 'pptx.themeEditor.colorAccent3' },
	{ key: 'accent4', labelKey: 'pptx.themeEditor.colorAccent4' },
	{ key: 'accent5', labelKey: 'pptx.themeEditor.colorAccent5' },
	{ key: 'accent6', labelKey: 'pptx.themeEditor.colorAccent6' },
	{ key: 'hlink', labelKey: 'pptx.themeEditor.colorHyperlink' },
	{ key: 'folHlink', labelKey: 'pptx.themeEditor.colorFollowedLink' },
];

/** A sensible default Office scheme used to fill any missing slots. */
const DEFAULT_SCHEME: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	hlink: '#0563C1',
	folHlink: '#954F72',
};

function seedColors(): PptxThemeColorScheme {
	return { ...DEFAULT_SCHEME, ...(props.theme?.colorScheme ?? {}) };
}

const editColors = ref<PptxThemeColorScheme>(seedColors());
const majorFont = ref(props.theme?.fontScheme?.majorFont?.latin ?? 'Calibri Light');
const minorFont = ref(props.theme?.fontScheme?.minorFont?.latin ?? 'Calibri');
const themeName = ref(props.theme?.name ?? 'Custom Theme');

/** Normalise a stored colour to a `#RRGGBB` value the native picker accepts. */
function hexFor(key: keyof PptxThemeColorScheme): string {
	const raw = String(editColors.value[key] ?? '#000000');
	const withHash = raw.startsWith('#') ? raw : `#${raw}`;
	return /^#[0-9a-fA-F]{6}$/u.test(withHash) ? withHash : '#000000';
}

function onColor(key: keyof PptxThemeColorScheme, e: Event): void {
	editColors.value = { ...editColors.value, [key]: (e.target as HTMLInputElement).value };
}

function reset(): void {
	editColors.value = seedColors();
	majorFont.value = props.theme?.fontScheme?.majorFont?.latin ?? 'Calibri Light';
	minorFont.value = props.theme?.fontScheme?.minorFont?.latin ?? 'Calibri';
	themeName.value = props.theme?.name ?? 'Custom Theme';
}

function apply(): void {
	emit('apply', {
		colorScheme: editColors.value,
		fontScheme: { majorFont: { latin: majorFont.value }, minorFont: { latin: minorFont.value } },
		name: themeName.value,
	});
}
</script>

<template>
	<aside
		class="fixed right-0 top-0 z-[1090] flex h-full w-72 flex-col gap-2 overflow-y-auto border-l border-border bg-card p-3 text-xs text-foreground shadow-2xl"
		role="dialog"
		:aria-label="t('pptx.themeEditor.panelLabel')"
	>
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-foreground">{{ t('pptx.themeEditor.title') }}</h3>
			<button
				type="button"
				class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				:title="t('pptx.themeEditor.close')"
				:aria-label="t('pptx.themeEditor.close')"
				@click="emit('close')"
			>
				✕
			</button>
		</div>

		<label class="flex flex-col gap-1">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.themeEditor.themeName') }}
			</span>
			<input
				v-model="themeName"
				type="text"
				:disabled="!props.canEdit"
				class="rounded border border-border bg-background/60 px-2 py-1 text-xs"
			/>
		</label>

		<div class="flex flex-col gap-1">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.themeEditor.colorScheme') }}
			</span>
			<div class="grid grid-cols-2 gap-1.5">
				<label
					v-for="slot in COLOR_SLOTS"
					:key="slot.key"
					class="flex items-center gap-1.5"
					:title="t(slot.labelKey)"
				>
					<input
						type="color"
						:value="hexFor(slot.key)"
						:disabled="!props.canEdit"
						class="h-6 w-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
						@input="onColor(slot.key, $event)"
					/>
					<span class="truncate text-[10px] text-muted-foreground">{{ t(slot.labelKey) }}</span>
				</label>
			</div>
		</div>

		<label class="flex flex-col gap-1">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.themeEditor.headingFont') }}
			</span>
			<input
				v-model="majorFont"
				type="text"
				:disabled="!props.canEdit"
				class="rounded border border-border bg-background/60 px-2 py-1 text-xs"
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.themeEditor.bodyFont') }}
			</span>
			<input
				v-model="minorFont"
				type="text"
				:disabled="!props.canEdit"
				class="rounded border border-border bg-background/60 px-2 py-1 text-xs"
			/>
		</label>

		<div class="flex gap-1.5 pt-1">
			<button
				type="button"
				:disabled="!props.canEdit"
				class="flex-1 rounded bg-primary px-2 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40"
				@click="apply"
			>
				{{ t('pptx.themeEditor.applyToPresentation') }}
			</button>
			<button
				type="button"
				:disabled="!props.canEdit"
				class="rounded border border-border bg-muted px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
				@click="reset"
			>
				{{ t('pptx.themeEditor.reset') }}
			</button>
		</div>
	</aside>
</template>
