<script setup lang="ts">
import type {
	TableStyleBorderSide,
	TableStyleEditorDescriptor,
	TableStyleEditorFieldEdit,
} from 'pptx-viewer-shared';
import {
	TABLE_STYLE_BORDER_SIDE_LABEL_KEYS,
	TABLE_STYLE_BORDER_SIDES,
	TABLE_STYLE_DASH_PRESETS,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import ThemeColorSwatchGrid from './ThemeColorSwatchGrid.vue';

/**
 * Field editors for whichever part `TableStyleEditor.vue` currently has
 * selected. Mirrors React's `TableStyleEditorFields.tsx`.
 */
defineProps<{
	descriptor: TableStyleEditorDescriptor;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	edit: [edit: TableStyleEditorFieldEdit];
}>();

const { t } = useI18n();

function textFlagEdit(
	flag: 'bold' | 'italic' | 'underline',
	value: boolean,
): TableStyleEditorFieldEdit {
	if (flag === 'bold') {
		return { kind: 'textBold', value };
	}
	if (flag === 'italic') {
		return { kind: 'textItalic', value };
	}
	return { kind: 'textUnderline', value };
}

function borderSide(descriptor: TableStyleEditorDescriptor, side: TableStyleBorderSide) {
	return descriptor.borders[side];
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-1">
			<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.tableStyleEditor.fillSection') }}
			</div>
			<div class="flex items-center gap-2 text-[11px]">
				<input
					type="color"
					:disabled="!canEdit"
					:value="descriptor.fill.color.hex"
					class="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
					@change="
						emit('edit', {
							kind: 'fillColor',
							hex: ($event.target as HTMLInputElement).value,
							ref: undefined,
						})
					"
				/>
				<label class="flex items-center gap-1">
					<input
						type="checkbox"
						:disabled="!canEdit"
						:checked="descriptor.fill.noFill"
						@change="
							emit('edit', {
								kind: 'fillNone',
								noFill: ($event.target as HTMLInputElement).checked,
							})
						"
					/>
					{{ t('pptx.tableStyleEditor.noFill') }}
				</label>
			</div>
			<ThemeColorSwatchGrid
				:disabled="!canEdit"
				:selected-ref="descriptor.fill.color.ref"
				:selected-hex="descriptor.fill.color.hex"
				@pick="(c) => emit('edit', { kind: 'fillColor', hex: c.hex, ref: c.ref })"
			/>
		</div>

		<template v-if="descriptor.hasTextAndBorders">
			<div class="flex flex-col gap-1">
				<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.tableStyleEditor.textSection') }}
				</div>
				<div class="flex gap-1">
					<button
						v-for="flag in ['bold', 'italic', 'underline'] as const"
						:key="flag"
						type="button"
						:disabled="!canEdit"
						class="rounded px-2 py-1 text-[11px] transition-colors"
						:class="descriptor.text[flag] ? 'bg-accent' : 'bg-muted hover:bg-accent'"
						@click="emit('edit', textFlagEdit(flag, !descriptor.text[flag]))"
					>
						{{ t(`pptx.format.${flag}`) }}
					</button>
				</div>
				<label class="flex items-center gap-2 text-[11px]">
					<span>{{ t('pptx.tableStyleEditor.textColor') }}</span>
					<input
						type="color"
						:disabled="!canEdit"
						:value="descriptor.text.color.hex"
						class="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
						@change="
							emit('edit', {
								kind: 'textColor',
								hex: ($event.target as HTMLInputElement).value,
								ref: undefined,
							})
						"
					/>
				</label>
				<ThemeColorSwatchGrid
					:disabled="!canEdit"
					:selected-ref="descriptor.text.color.ref"
					:selected-hex="descriptor.text.color.hex"
					@pick="(c) => emit('edit', { kind: 'textColor', hex: c.hex, ref: c.ref })"
				/>
			</div>

			<div class="flex flex-col gap-1">
				<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.tableStyleEditor.bordersSection') }}
				</div>
				<div
					v-for="side in TABLE_STYLE_BORDER_SIDES"
					:key="side"
					class="flex items-center gap-1.5 text-[11px]"
				>
					<span class="w-28 shrink-0 text-muted-foreground">{{
						t(TABLE_STYLE_BORDER_SIDE_LABEL_KEYS[side])
					}}</span>
					<input
						type="color"
						:disabled="!canEdit"
						:value="borderSide(descriptor, side).color.hex"
						class="h-6 w-7 rounded border border-border bg-transparent cursor-pointer"
						@change="
							emit('edit', {
								kind: 'borderColor',
								side,
								hex: ($event.target as HTMLInputElement).value,
								ref: undefined,
							})
						"
					/>
					<input
						type="number"
						min="0"
						max="20"
						:disabled="!canEdit"
						:value="borderSide(descriptor, side).width"
						class="w-12 rounded border border-border bg-background px-1 py-0.5"
						@change="
							emit('edit', {
								kind: 'borderWidth',
								side,
								width: Number(($event.target as HTMLInputElement).value),
							})
						"
					/>
					<select
						:disabled="!canEdit"
						:value="borderSide(descriptor, side).dash"
						class="rounded border border-border bg-background px-1 py-0.5"
						@change="
							emit('edit', {
								kind: 'borderDash',
								side,
								dash: ($event.target as HTMLSelectElement).value,
							})
						"
					>
						<option v-for="dash in TABLE_STYLE_DASH_PRESETS" :key="dash" :value="dash">
							{{ dash }}
						</option>
					</select>
					<label class="flex items-center gap-1 shrink-0">
						<input
							type="checkbox"
							:disabled="!canEdit"
							:checked="borderSide(descriptor, side).noFill"
							@change="
								emit('edit', {
									kind: 'borderNone',
									side,
									noFill: ($event.target as HTMLInputElement).checked,
								})
							"
						/>
						{{ t('pptx.tableStyleEditor.noBorder') }}
					</label>
				</div>
			</div>
		</template>
	</div>
</template>
