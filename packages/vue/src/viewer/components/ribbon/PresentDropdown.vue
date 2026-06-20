<script setup lang="ts">
/**
 * PresentDropdown: the Vue 3 port of React's `PresentDropdown` from
 * `toolbar/PresentDropdown.tsx`. Renders the split Present button plus its
 * options menu (Presenter View, Rehearse Timings, Set Up Slide Show, Present
 * Online, Subtitles). A faithful, mechanical port for visual + behavioral
 * parity: class strings are copied verbatim, callbacks arrive as function props,
 * and the React `useState` + outside-click effect becomes `useDropdown`.
 */
import {
	Captions,
	Check,
	ChevronDown,
	Clock,
	Monitor,
	Play,
	Radio,
	Settings,
} from 'lucide-vue-next';

import { cn } from '../../../utils';
import { useDropdown } from './use-dropdown';

interface Props {
	isActive: boolean;
	onPresent: () => void;
	onPresenterView?: () => void;
	onRehearse?: () => void;
	onSetUpSlideShow?: () => void;
	onBroadcast?: () => void;
	onToggleSubtitles?: () => void;
	showSubtitles?: boolean;
}

const props = defineProps<Props>();

const dd = useDropdown();
</script>

<template>
	<div :ref="dd.root" class="relative">
		<div class="inline-flex border-l border-border">
			<button
				type="button"
				:class="
					cn(
						'px-2 py-1 transition-colors',
						props.isActive ? 'bg-primary text-white' : 'hover:bg-accent text-foreground',
					)
				"
				title="Present (fullscreen)"
				@click="props.onPresent()"
			>
				Present
			</button>
			<button
				type="button"
				:class="
					cn(
						'px-1 py-1 transition-colors border-l border-border',
						dd.open.value ? 'bg-primary text-white' : 'hover:bg-accent text-foreground',
					)
				"
				title="Presentation options"
				aria-label="Presentation options"
				@click="dd.toggle()"
			>
				<ChevronDown class="w-3 h-3" />
			</button>
		</div>
		<template v-if="dd.open.value">
			<button
				type="button"
				class="fixed inset-0 z-40"
				aria-label="Close menu"
				@click="dd.close()"
			/>
			<div
				class="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1"
			>
				<button
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onPresent();
					"
				>
					<Play class="w-3.5 h-3.5 text-muted-foreground" />
					Present
				</button>
				<button
					v-if="props.onPresenterView"
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onPresenterView?.();
					"
				>
					<Monitor class="w-3.5 h-3.5 text-muted-foreground" />
					Presenter View
				</button>
				<button
					v-if="props.onRehearse"
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onRehearse?.();
					"
				>
					<Clock class="w-3.5 h-3.5 text-muted-foreground" />
					Rehearse Timings
				</button>
				<!-- Slide Show settings divider -->
				<div class="my-1 border-t border-border/60" />
				<button
					v-if="props.onSetUpSlideShow"
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onSetUpSlideShow?.();
					"
				>
					<Settings class="w-3.5 h-3.5 text-muted-foreground" />
					Set Up Slide Show
				</button>
				<button
					v-if="props.onBroadcast"
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onBroadcast?.();
					"
				>
					<Radio class="w-3.5 h-3.5 text-muted-foreground" />
					Present Online
				</button>
				<button
					v-if="props.onToggleSubtitles"
					type="button"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="
						dd.close();
						props.onToggleSubtitles?.();
					"
				>
					<Captions class="w-3.5 h-3.5 text-muted-foreground" />
					<span class="flex-1 text-left">Subtitles</span>
					<Check v-if="props.showSubtitles" class="w-3 h-3 text-primary" />
				</button>
			</div>
		</template>
	</div>
</template>
