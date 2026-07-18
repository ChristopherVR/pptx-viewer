import type { ComputedRef, Ref } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

/** One embeddable framework demo deployed next to the docs on GitHub Pages. */
export interface DemoFramework {
	key: string;
	label: string;
	path: string;
}

export const DEMO_ROOT = 'https://christophervr.github.io/pptx-viewer/';

export const DEMO_FRAMEWORKS: DemoFramework[] = [
	{ key: 'react', label: 'React', path: 'demo/' },
	{ key: 'vue', label: 'Vue', path: 'demo-vue/' },
	{ key: 'angular', label: 'Angular', path: 'demo-angular/' },
	{ key: 'svelte', label: 'Svelte', path: 'demo-svelte/' },
	{ key: 'vanilla', label: 'VanillaJS', path: 'demo-vanilla/' },
];

export type LiveDemoMode = 'solo' | 'collab';

export interface LiveDemoState {
	started: Ref<boolean>;
	mode: Ref<LiveDemoMode>;
	activeKey: Ref<string>;
	guestKey: Ref<string>;
	roomId: Ref<string>;
	soloSrc: ComputedRef<string>;
	hostSrc: ComputedRef<string>;
	guestSrc: ComputedRef<string>;
	activeLabel: ComputedRef<string>;
	guestLabel: ComputedRef<string>;
	start: () => void;
	selectFramework: (key: string) => void;
	selectGuest: (key: string) => void;
	setMode: (mode: LiveDemoMode) => void;
}

function frameworkByKey(key: string): DemoFramework {
	return DEMO_FRAMEWORKS.find((f) => f.key === key) ?? DEMO_FRAMEWORKS[0];
}

function randomRoomId(): string {
	return `landing-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * State for the landing page's embedded live demo: a framework switcher over
 * the deployed demo apps, plus a two-pane collaboration mode where both panes
 * join the same serverless y-webrtc room (same-origin iframes sync through
 * BroadcastChannel, so it works entirely inside the visitor's browser).
 *
 * The iframes only load once the section scrolls near the viewport (or the
 * visitor clicks the load button), so landing visitors who never reach the
 * section download nothing.
 */
export function useLiveDemo(section: Ref<HTMLElement | null>): LiveDemoState {
	const started = ref(false);
	const mode = ref<LiveDemoMode>('solo');
	const activeKey = ref('react');
	const guestKey = ref('vue');
	const roomId = ref('');

	const soloSrc = computed(() => `${DEMO_ROOT}${frameworkByKey(activeKey.value).path}?sample=1`);
	const hostSrc = computed(
		() =>
			`${DEMO_ROOT}${frameworkByKey(activeKey.value).path}?sample=1&room=${roomId.value}&transport=webrtc&name=Ada`,
	);
	const guestSrc = computed(
		() =>
			`${DEMO_ROOT}${frameworkByKey(guestKey.value).path}?room=${roomId.value}&transport=webrtc&name=Grace`,
	);
	const activeLabel = computed(() => frameworkByKey(activeKey.value).label);
	const guestLabel = computed(() => frameworkByKey(guestKey.value).label);

	function start(): void {
		started.value = true;
	}

	/** Pick a guest framework different from the host so the pairing shows off
	 *  cross-framework sync by default. */
	function fallbackGuest(hostKey: string): string {
		const other = DEMO_FRAMEWORKS.find((f) => f.key !== hostKey);
		return other ? other.key : hostKey;
	}

	function selectFramework(key: string): void {
		if (key === activeKey.value) {
			return;
		}
		activeKey.value = key;
		if (guestKey.value === key) {
			guestKey.value = fallbackGuest(key);
		}
		// A new host must seed a fresh session: re-seeding an existing Y.Doc with
		// the sample deck again would duplicate its slides.
		if (mode.value === 'collab') {
			roomId.value = randomRoomId();
		}
	}

	function selectGuest(key: string): void {
		if (key === guestKey.value) {
			return;
		}
		// The guest merely rejoins the same room; the deck lives in the host pane
		// and arrives through late-joiner sync.
		guestKey.value = key === activeKey.value ? fallbackGuest(activeKey.value) : key;
	}

	function setMode(next: LiveDemoMode): void {
		if (next === mode.value) {
			return;
		}
		mode.value = next;
		started.value = true;
		if (next === 'collab') {
			roomId.value = randomRoomId();
		}
	}

	let observer: IntersectionObserver | null = null;
	onMounted(() => {
		if (started.value || !section.value || typeof IntersectionObserver === 'undefined') {
			return;
		}
		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					started.value = true;
					observer?.disconnect();
					observer = null;
				}
			},
			{ rootMargin: '300px 0px' },
		);
		observer.observe(section.value);
	});
	onBeforeUnmount(() => {
		observer?.disconnect();
		observer = null;
	});

	return {
		started,
		mode,
		activeKey,
		guestKey,
		roomId,
		soloSrc,
		hostSrc,
		guestSrc,
		activeLabel,
		guestLabel,
		start,
		selectFramework,
		selectGuest,
		setMode,
	};
}
