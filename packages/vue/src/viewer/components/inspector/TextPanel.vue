<script setup lang="ts">
import type { PptxElement, PptxTextWarpPreset, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Text3DProperties from './Text3DProperties.vue';
import TextEffectsPanel from './TextEffectsPanel.vue';
import TextWarpGallery from './TextWarpGallery.vue';

/**
 * TextPanel: typography inspector for the Vue `pptx-vue-viewer` editor.
 *
 * Exposes character/paragraph formatting (`fontFamily`, `fontSize`, `bold`,
 * `italic`, `underline`, `strikethrough`, `color`, `align`, `vAlign`) read from
 * `element.textStyle`. Each control emits a SHALLOW `update` patch carrying the
 * FULL merged `textStyle` sub-object so the parent can forward it verbatim to
 * `ops.updateElement(id, patch)`.
 *
 * Only text-bearing elements (`hasTextProperties`) expose editable controls;
 * other element types show a muted note instead.
 */
type AlignValue = NonNullable<TextStyle['align']>;
type VAlignValue = NonNullable<TextStyle['vAlign']>;

const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const FONT_OPTIONS: ReadonlyArray<string> = [
	'Arial',
	'Calibri',
	'Cambria',
	'Georgia',
	'Times New Roman',
	'Trebuchet MS',
	'Verdana',
];

const ALIGN_OPTIONS: ReadonlyArray<{ value: AlignValue; labelKey: string }> = [
	{ value: 'left', labelKey: 'pptx.textPanel.alignLeft' },
	{ value: 'center', labelKey: 'pptx.textPanel.alignCenter' },
	{ value: 'right', labelKey: 'pptx.textPanel.alignRight' },
	{ value: 'justify', labelKey: 'pptx.textPanel.alignJustify' },
];

const VALIGN_OPTIONS: ReadonlyArray<{ value: VAlignValue; labelKey: string }> = [
	{ value: 'top', labelKey: 'pptx.textPanel.valignTop' },
	{ value: 'middle', labelKey: 'pptx.textPanel.valignMiddle' },
	{ value: 'bottom', labelKey: 'pptx.textPanel.valignBottom' },
];

const TOGGLES: ReadonlyArray<{
	key: 'bold' | 'italic' | 'underline' | 'strikethrough';
	label: string;
	titleKey: string;
}> = [
	{ key: 'bold', label: 'B', titleKey: 'pptx.textPanel.bold' },
	{ key: 'italic', label: 'I', titleKey: 'pptx.textPanel.italic' },
	{ key: 'underline', label: 'U', titleKey: 'pptx.textPanel.underline' },
	{ key: 'strikethrough', label: 'S', titleKey: 'pptx.textPanel.strikethrough' },
];

const applicable = computed(() => hasTextProperties(props.element));

const textStyle = computed<TextStyle | undefined>(() =>
	hasTextProperties(props.element) ? props.element.textStyle : undefined,
);

const fontFamily = computed<string>(() => textStyle.value?.fontFamily ?? '');
const fontSize = computed<number>(() => textStyle.value?.fontSize ?? 18);
const color = computed<string>(() => textStyle.value?.color ?? '#000000');
const align = computed<AlignValue | undefined>(() => textStyle.value?.align);
const vAlign = computed<VAlignValue | undefined>(() => textStyle.value?.vAlign);

function patchTextStyle(next: Partial<TextStyle>): void {
	emit('update', { textStyle: { ...textStyle.value, ...next } } as Partial<PptxElement>);
}

function onFontFamily(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	patchTextStyle({ fontFamily: value.length > 0 ? value : undefined });
}

function onFontSize(event: Event): void {
	const raw = Number.parseFloat((event.target as HTMLInputElement).value);
	patchTextStyle({ fontSize: Number.isFinite(raw) ? Math.max(1, raw) : 1 });
}

function onColor(event: Event): void {
	patchTextStyle({ color: (event.target as HTMLInputElement).value });
}

function toggle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
	patchTextStyle({ [key]: !textStyle.value?.[key] });
}

function isActive(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): boolean {
	return Boolean(textStyle.value?.[key]);
}

function setAlign(value: AlignValue): void {
	patchTextStyle({ align: value });
}

function setVAlign(value: VAlignValue): void {
	patchTextStyle({ vAlign: value });
}

function onWarpSelect(preset: PptxTextWarpPreset | undefined): void {
	patchTextStyle({ textWarpPreset: preset });
}

function onTextEffectPatch(patch: Partial<TextStyle>): void {
	patchTextStyle(patch);
}
</script>

<template>
	<div class="pptx-vue-text-panel flex flex-col gap-2 p-2">
		<h3
			class="pptx-vue-text-title text-xs font-semibold uppercase tracking-wide text-muted-foreground"
		>
			{{ t('pptx.textPanel.title') }}
		</h3>

		<p v-if="!applicable" class="pptx-vue-text-muted text-xs text-muted-foreground">
			{{ t('pptx.textPanel.noTextProperties') }}
		</p>

		<div v-else class="pptx-vue-text-fields flex flex-col gap-2">
			<label class="pptx-vue-text-field flex flex-col gap-1">
				<span class="pptx-vue-text-label text-muted-foreground">{{
					t('pptx.textPanel.font')
				}}</span>
				<select
					class="pptx-vue-text-input w-full bg-muted border border-border rounded px-2 py-1"
					:value="fontFamily"
					@change="onFontFamily"
				>
					<option value="">{{ t('pptx.textPanel.default') }}</option>
					<option v-for="font in FONT_OPTIONS" :key="font" :value="font">
						{{ font }}
					</option>
					<option v-if="fontFamily && !FONT_OPTIONS.includes(fontFamily)" :value="fontFamily">
						{{ fontFamily }}
					</option>
				</select>
			</label>

			<div class="pptx-vue-text-row grid grid-cols-2 gap-2">
				<label class="pptx-vue-text-field flex flex-col gap-1">
					<span class="pptx-vue-text-label text-muted-foreground">{{
						t('pptx.textPanel.size')
					}}</span>
					<input
						type="number"
						class="pptx-vue-text-input w-full bg-muted border border-border rounded px-2 py-1"
						min="1"
						step="1"
						:value="fontSize"
						@input="onFontSize"
					/>
				</label>
				<label class="pptx-vue-text-field flex flex-col gap-1">
					<span class="pptx-vue-text-label text-muted-foreground">{{
						t('pptx.textPanel.color')
					}}</span>
					<input
						type="color"
						class="pptx-vue-text-color w-full h-8 bg-muted border border-border rounded p-0.5"
						:value="color"
						@input="onColor"
					/>
				</label>
			</div>

			<div class="pptx-vue-text-field flex flex-col gap-1">
				<span class="pptx-vue-text-label text-muted-foreground">{{
					t('pptx.textPanel.style')
				}}</span>
				<div class="pptx-vue-text-toggles flex flex-wrap gap-1">
					<button
						v-for="tg in TOGGLES"
						:key="tg.key"
						type="button"
						class="pptx-vue-text-toggle min-w-8 rounded border border-border px-2 py-1 transition-colors"
						:class="
							isActive(tg.key)
								? 'pptx-vue-text-toggle-active bg-primary text-white font-semibold'
								: 'bg-muted hover:bg-accent'
						"
						:aria-pressed="isActive(tg.key)"
						:title="t(tg.titleKey)"
						@click="toggle(tg.key)"
					>
						{{ tg.label }}
					</button>
				</div>
			</div>

			<div class="pptx-vue-text-field flex flex-col gap-1">
				<span class="pptx-vue-text-label text-muted-foreground">
					{{ t('pptx.textPanel.horizontalAlign') }}
				</span>
				<div class="pptx-vue-text-toggles flex flex-wrap gap-1">
					<button
						v-for="opt in ALIGN_OPTIONS"
						:key="opt.value"
						type="button"
						class="pptx-vue-text-toggle min-w-8 rounded border border-border px-2 py-1 transition-colors"
						:class="
							align === opt.value
								? 'pptx-vue-text-toggle-active bg-primary text-white font-semibold'
								: 'bg-muted hover:bg-accent'
						"
						:aria-pressed="align === opt.value"
						:title="t(opt.labelKey)"
						@click="setAlign(opt.value)"
					>
						{{ t(opt.labelKey) }}
					</button>
				</div>
			</div>

			<div class="pptx-vue-text-field flex flex-col gap-1">
				<span class="pptx-vue-text-label text-muted-foreground">
					{{ t('pptx.textPanel.verticalAlign') }}
				</span>
				<div class="pptx-vue-text-toggles flex flex-wrap gap-1">
					<button
						v-for="opt in VALIGN_OPTIONS"
						:key="opt.value"
						type="button"
						class="pptx-vue-text-toggle min-w-8 rounded border border-border px-2 py-1 transition-colors"
						:class="
							vAlign === opt.value
								? 'pptx-vue-text-toggle-active bg-primary text-white font-semibold'
								: 'bg-muted hover:bg-accent'
						"
						:aria-pressed="vAlign === opt.value"
						:title="t(opt.labelKey)"
						@click="setVAlign(opt.value)"
					>
						{{ t(opt.labelKey) }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
