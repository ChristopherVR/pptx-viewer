<script setup lang="ts">
/**
 * DirectionPicker: choose a transition direction token. Vue port of React's
 * `DirectionPicker`. Renders a row for 3-or-fewer directions, otherwise a 3x3
 * arrow grid placed by compass position.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/** Arrow glyphs for direction tokens. */
const DIR_ARROWS: Record<string, string> = {
	l: '←',
	r: '→',
	u: '↑',
	d: '↓',
	lu: '↖',
	ld: '↙',
	ru: '↗',
	rd: '↘',
	in: '◉',
	out: '◎',
	horz: '↔',
	vert: '↕',
};

/** Grid positions (row, col) for the 8-direction layout. */
const GRID_POSITIONS: Record<string, [number, number]> = {
	lu: [0, 0],
	u: [0, 1],
	ru: [0, 2],
	l: [1, 0],
	r: [1, 2],
	ld: [2, 0],
	d: [2, 1],
	rd: [2, 2],
};

const props = defineProps<{ directions: readonly string[]; value: string | undefined }>();
const emit = defineEmits<{ change: [direction: string] }>();

const { t } = useI18n();

const isGrid = computed(() => props.directions.length > 3);

/** 3x3 grid cells, each holding a direction token or null (empty slot). */
const cells = computed<(string | null)[]>(() => {
	const grid: (string | null)[] = Array.from({ length: 9 }, () => null);
	for (const dir of props.directions) {
		const pos = GRID_POSITIONS[dir];
		if (pos) {
			grid[pos[0] * 3 + pos[1]] = dir;
		}
	}
	return grid;
});

function glyph(dir: string): string {
	return DIR_ARROWS[dir] ?? dir;
}

/**
 * Readable name for a direction token. The raw OOXML token ("lu", "rd") is
 * what the button used to announce, which names nothing a user recognises.
 */
function title(dir: string): string {
	return t(`pptx.transition.dir.${dir}`);
}
</script>

<template>
	<div v-if="!isGrid" class="flex gap-1">
		<button
			v-for="dir in directions"
			:key="dir"
			type="button"
			class="rounded border px-2 py-1 text-xs"
			:class="
				value === dir
					? 'border-primary bg-primary text-white'
					: 'border-border bg-muted hover:bg-accent'
			"
			:title="title(dir)"
			:aria-label="title(dir)"
			:aria-pressed="value === dir"
			@click="emit('change', dir)"
		>
			{{ glyph(dir) }}
		</button>
	</div>
	<div v-else class="inline-grid grid-cols-3 gap-0.5">
		<template v-for="(cell, i) in cells" :key="i">
			<div v-if="!cell" class="h-6 w-6" />
			<button
				v-else
				type="button"
				class="flex h-6 w-6 items-center justify-center rounded border text-xs"
				:class="
					value === cell
						? 'border-primary bg-primary text-white'
						: 'border-border bg-muted hover:bg-accent'
				"
				:title="title(cell)"
				:aria-label="title(cell)"
				:aria-pressed="value === cell"
				@click="emit('change', cell)"
			>
				{{ glyph(cell) }}
			</button>
		</template>
	</div>
</template>
