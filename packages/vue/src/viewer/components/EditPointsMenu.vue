<script setup lang="ts">
/**
 * EditPointsMenu: the Edit Points right-click menu (a vertex or a segment).
 * Vue port of React's `canvas/EditPointsMenu.tsx`. Entries, order, greying and
 * checks come from the shared session; this is the Vue paint.
 *
 * Rendered inside the scaled stage at the click's slide position and scaled
 * back by `inverseScale`, so it stays screen-sized at every zoom without a
 * teleport. Item classes mirror `ContextMenu.vue`.
 */
import type { EditPointsCommandId, EditPointsMenuView } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

defineProps<{ menu: EditPointsMenuView }>();
const emit = defineEmits<{ run: [id: EditPointsCommandId] }>();
const { t } = useI18n();
</script>

<template>
	<div
		role="menu"
		:aria-label="t('pptx.editPoints.menu')"
		data-pptx-edit-points-menu="true"
		class="pptx-vue-context-menu absolute z-[61] min-w-[180px] select-none rounded border border-border bg-popover py-1.5 text-xs leading-4 text-popover-foreground shadow-2xl"
		:style="{
			left: `${menu.x}px`,
			top: `${menu.y}px`,
			transform: `scale(${menu.inverseScale})`,
			transformOrigin: '0 0',
		}"
		@pointerdown.stop
		@mousedown.stop
		@click.stop
		@contextmenu.prevent.stop
	>
		<template v-for="entry in menu.entries" :key="entry.id">
			<div
				v-if="entry.separatorBefore"
				class="pptx-vue-context-menu__separator my-1 border-t border-border"
				role="separator"
			/>
			<div role="none" :data-pptx-edit-points-command="entry.id">
				<button
					type="button"
					:role="entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
					:aria-checked="entry.checked === undefined ? undefined : entry.checked"
					class="pptx-vue-context-menu__item block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-inherit hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
					:class="{
						'pptx-vue-context-menu__item--disabled pointer-events-none cursor-default opacity-45 hover:bg-transparent':
							entry.disabled,
					}"
					:disabled="entry.disabled"
					:aria-disabled="entry.disabled ? 'true' : undefined"
					@click="emit('run', entry.id)"
				>
					<span
						v-if="entry.checked !== undefined"
						class="mr-1.5 inline-block w-3"
						aria-hidden="true"
					>
						{{ entry.checked ? '✓' : '' }}
					</span>
					{{ t(entry.labelKey) }}
				</button>
			</div>
		</template>
	</div>
</template>
