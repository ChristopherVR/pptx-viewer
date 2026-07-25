import {
	getSpeechRecognitionCtor,
	mergeCaptionResults,
	stepPresenterZoom,
} from 'pptx-viewer-shared';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	SpeechRecognitionLite,
} from 'pptx-viewer-shared';

export interface VanillaPresenterConsoleOptions {
	container: HTMLElement;
	getSnapshot: () => PresentationSnapshot;
	getSlides: () => Array<{ hidden?: boolean }>;
	getCurrent: () => number;
	update: (patch: Partial<PresentationSnapshot>) => void;
	navigate: (index: number) => void;
	toggleAudience: () => void;
	end: () => void;
}

export function mountPresenterConsole(options: VanillaPresenterConsoleOptions): () => void {
	const doc = options.container.ownerDocument;
	const root = doc.createElement('div');
	let recognition: SpeechRecognitionLite | null = null;
	root.className = 'pptxv-presenter-console';
	Object.assign(root.style, {
		position: 'absolute',
		inset: '0 0 auto',
		zIndex: '120',
		display: 'flex',
		flexWrap: 'wrap',
		gap: '4px',
		padding: '8px 12px',
		background: 'var(--pptx-card, #020617)',
		color: 'var(--pptx-foreground, #e2e8f0)',
	});
	const button = (label: string, action: () => void) => {
		const el = doc.createElement('button');
		el.type = 'button';
		el.textContent = label;
		Object.assign(el.style, {
			border: '0',
			borderRadius: '5px',
			padding: '7px 10px',
			background: 'var(--pptx-secondary, #ffffff12)',
			color: 'inherit',
			cursor: 'pointer',
		});
		el.addEventListener('click', action);
		root.append(el);
		return el;
	};
	button('Pause', () => options.update({ paused: !options.getSnapshot().paused }));
	button('Reset', () => options.update({ paused: false, elapsedMs: 0 }));
	button('All slides', () => showGrid());
	button('Zoom -', () => zoom(-1));
	button('Zoom +', () => zoom(1));
	for (const tool of ['laser', 'pen', 'highlighter', 'eraser'] as PresentationPointerTool[]) {
		button(tool, () =>
			options.update({
				pointer: {
					...(options.getSnapshot().pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }),
					tool,
				},
			}),
		);
	}
	button('B', () => blank('black'));
	button('W', () => blank('white'));
	button('Captions', () => toggleCaptions());
	const spacer = doc.createElement('span');
	spacer.style.flex = '1';
	root.append(spacer);
	button('Audience', options.toggleAudience);
	button('End', options.end);
	options.container.append(root);
	function toggleCaptions() {
		const enabled = !options.getSnapshot().subtitlesVisible;
		options.update({ subtitlesVisible: enabled, caption: enabled ? '' : undefined });
		if (!enabled) {
			recognition?.stop();
			recognition = null;
			return;
		}
		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) {
			options.update({ caption: 'Live captions are not supported in this browser.' });
			return;
		}
		recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = doc.documentElement.lang || 'en-US';
		recognition.onresult = (event) =>
			options.update({ caption: mergeCaptionResults(event.resultIndex, event.results) });
		recognition.onerror = () => options.update({ caption: 'Live captions are unavailable.' });
		recognition.onend = () => {
			if (options.getSnapshot().subtitlesVisible) {
				try {
					recognition?.start();
				} catch {
					/* browser controls restart timing */
				}
			}
		};
		recognition.start();
	}
	function zoom(direction: -1 | 1) {
		options.update({
			zoom: stepPresenterZoom(
				options.getSnapshot().zoom ?? { scale: 1, originX: 0.5, originY: 0.5 },
				direction,
			),
		});
	}
	function blank(value: 'black' | 'white') {
		options.update({ blackout: options.getSnapshot().blackout === value ? 'none' : value });
	}
	function showGrid() {
		const grid = doc.createElement('div');
		Object.assign(grid.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '130',
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
			gap: '14px',
			padding: '70px 24px 24px',
			overflow: 'auto',
			background: 'var(--pptx-card, #020617fa)',
		});
		options.getSlides().forEach((slide, index) => {
			const item = doc.createElement('button');
			item.textContent = `Slide ${index + 1}${slide.hidden ? ' - hidden' : ''}`;
			Object.assign(item.style, {
				minHeight: '100px',
				border:
					index === options.getCurrent()
						? '2px solid var(--pptx-primary, #38bdf8)'
						: '1px solid var(--pptx-border, #ffffff22)',
				borderRadius: '6px',
				background: 'var(--pptx-secondary, #ffffff12)',
				color: 'var(--pptx-foreground, #f8fafc)',
				opacity: slide.hidden ? '.45' : '1',
				cursor: 'pointer',
			});
			item.onclick = () => {
				options.navigate(index);
				grid.remove();
			};
			grid.append(item);
		});
		grid.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			grid.remove();
		});
		options.container.append(grid);
	}
	return () => {
		recognition?.stop();
		root.remove();
	};
}

export function renderAudienceEffects(
	container: HTMLElement,
	snapshot: PresentationSnapshot,
): void {
	container.querySelectorAll('.pptxv-presenter-effect').forEach((node) => node.remove());
	const add = (className: string) => {
		const el = container.ownerDocument.createElement('div');
		el.className = `pptxv-presenter-effect ${className}`;
		container.append(el);
		return el;
	};
	if (snapshot.blackout !== 'none') {
		const el = add('blank');
		Object.assign(el.style, {
			position: 'absolute',
			inset: '0',
			zIndex: '75',
			background: snapshot.blackout,
		});
	}
	if (snapshot.pointer?.tool === 'laser') {
		const el = add('laser');
		Object.assign(el.style, {
			position: 'absolute',
			zIndex: '76',
			width: '20px',
			height: '20px',
			left: `${snapshot.pointer.x * 100}%`,
			top: `${snapshot.pointer.y * 100}%`,
			transform: 'translate(-50%,-50%)',
			borderRadius: '50%',
			background: '#ef4444',
			boxShadow: '0 0 20px 8px #ef444488',
		});
	}
	const currentStrokes = snapshot.inkStrokes?.filter(
		(stroke) => stroke.slideIndex === snapshot.slideIndex,
	);
	if (currentStrokes?.length) {
		const svg = container.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('pptxv-presenter-effect', 'ink');
		svg.setAttribute('viewBox', '0 0 1 1');
		svg.setAttribute('preserveAspectRatio', 'none');
		Object.assign(svg.style, {
			position: 'absolute',
			zIndex: '76',
			inset: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
		});
		for (const stroke of currentStrokes) {
			const path = container.ownerDocument.createElementNS(
				'http://www.w3.org/2000/svg',
				'polyline',
			);
			path.setAttribute('points', stroke.points.map(({ x, y }) => `${x},${y}`).join(' '));
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', stroke.color);
			path.setAttribute('stroke-width', String(stroke.width));
			path.setAttribute('vector-effect', 'non-scaling-stroke');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			if (stroke.tool === 'highlighter') {
				path.setAttribute('stroke-opacity', '.4');
			}
			svg.appendChild(path);
		}
		container.appendChild(svg);
	}
	if (snapshot.subtitlesVisible && snapshot.caption) {
		const el = add('caption');
		el.textContent = snapshot.caption;
		Object.assign(el.style, {
			position: 'absolute',
			zIndex: '77',
			left: '10%',
			right: '10%',
			bottom: '32px',
			padding: '12px 24px',
			borderRadius: '8px',
			background: '#000c',
			color: '#fff',
			textAlign: 'center',
			fontSize: '20px',
		});
	}
}
