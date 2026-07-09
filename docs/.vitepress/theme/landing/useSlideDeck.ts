import type { Ref } from 'vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Drives the landing page's presentation conceit:
 * - reveals [data-reveal] elements as they enter the viewport
 * - tracks which [data-slide] section is active for the presenter counter
 * - exposes overall scroll progress for the presenter progress bar
 */
export function useSlideDeck(root: Ref<HTMLElement | null>) {
	const current = ref('01');
	const total = ref('--');
	const progress = ref(0);

	let sections: HTMLElement[] = [];
	let observer: IntersectionObserver | undefined;
	let ticking = false;

	const update = () => {
		ticking = false;
		const doc = document.documentElement;
		const max = doc.scrollHeight - window.innerHeight;
		progress.value = max > 0 ? Math.min(1, window.scrollY / max) : 0;

		const pivot = window.innerHeight * 0.55;
		let active = 0;
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].getBoundingClientRect().top <= pivot) {
				active = i;
			}
		}
		current.value = String(active + 1).padStart(2, '0');
	};

	const onScroll = () => {
		if (ticking) {
			return;
		}
		ticking = true;
		requestAnimationFrame(update);
	};

	onMounted(() => {
		const el = root.value;
		if (!el) {
			return;
		}

		sections = Array.from(el.querySelectorAll<HTMLElement>('[data-slide]'));
		total.value = String(Math.max(sections.length, 1)).padStart(2, '0');

		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					entry.target.classList.add('is-revealed');
					observer?.unobserve(entry.target);
				}
			},
			{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
		);
		el.querySelectorAll('[data-reveal]').forEach((node) => observer?.observe(node));

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		update();
	});

	onBeforeUnmount(() => {
		observer?.disconnect();
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onScroll);
	});

	return { current, total, progress };
}
