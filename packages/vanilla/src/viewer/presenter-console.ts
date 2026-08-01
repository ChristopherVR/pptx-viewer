import type { PresentationSnapshot } from 'pptx-viewer-shared';

/**
 * Audience-facing show effects: blackout, the laser dot, ink strokes and the
 * live caption bar, painted straight onto the show container.
 *
 * These are what the ROOM sees, not what the presenter sees, which is why they
 * survived the presenter console being replaced by a real presenter view
 * (`viewer/presenter/*`): the console is the presenter's screen, this is the
 * mirror of the audience display's own overlay.
 *
 * @module viewer/presenter-console
 */

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
