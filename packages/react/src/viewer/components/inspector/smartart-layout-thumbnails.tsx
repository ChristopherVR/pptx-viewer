import React from 'react';

// ---------------------------------------------------------------------------
// SVG Mini-Thumbnails for SmartArt layouts
// ---------------------------------------------------------------------------

export function ProcessThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='2' y='10' width='10' height='12' rx='2' fill='currentColor' opacity={0.7} />
			<path d='M14 16 L17 16' stroke='currentColor' strokeWidth='1.5' opacity={0.5} />
			<rect x='19' y='10' width='10' height='12' rx='2' fill='currentColor' opacity={0.7} />
			<path d='M31 16 L34 16' stroke='currentColor' strokeWidth='1.5' opacity={0.5} />
			<rect x='36' y='10' width='10' height='12' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function HierarchyThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='17' y='2' width='14' height='8' rx='2' fill='currentColor' opacity={0.7} />
			<path d='M24 10 L12 18 M24 10 L36 18' stroke='currentColor' strokeWidth='1' opacity={0.5} />
			<rect x='4' y='18' width='14' height='8' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='30' y='18' width='14' height='8' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function CycleThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<circle cx='24' cy='5' r='4' fill='currentColor' opacity={0.7} />
			<circle cx='37' cy='20' r='4' fill='currentColor' opacity={0.7} />
			<circle cx='11' cy='20' r='4' fill='currentColor' opacity={0.7} />
			<path
				d='M28 6 L34 17 M33 23 L14 23 M14 18 L20 7'
				stroke='currentColor'
				strokeWidth='1'
				opacity={0.4}
				fill='none'
			/>
		</svg>
	);
}

export function MatrixThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='4' y='3' width='18' height='11' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='26' y='3' width='18' height='11' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='4' y='18' width='18' height='11' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='26' y='18' width='18' height='11' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function PyramidThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='16' y='2' width='16' height='8' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='10' y='12' width='28' height='8' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='4' y='22' width='40' height='8' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function ListThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='4' y='3' width='40' height='7' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='4' y='13' width='40' height='7' rx='2' fill='currentColor' opacity={0.7} />
			<rect x='4' y='23' width='40' height='7' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function FunnelThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<path d='M4 3 L44 3 L28 16 L28 29 L20 29 L20 16 Z' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function TargetThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<circle cx='24' cy='16' r='14' fill='currentColor' opacity={0.3} />
			<circle cx='24' cy='16' r='9' fill='currentColor' opacity={0.5} />
			<circle cx='24' cy='16' r='4' fill='currentColor' opacity={0.8} />
		</svg>
	);
}

export function GearThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<circle cx='16' cy='16' r='9' fill='currentColor' opacity={0.7} />
			<circle cx='16' cy='16' r='3' fill='white' opacity={0.9} />
			<circle cx='33' cy='16' r='6' fill='currentColor' opacity={0.5} />
			<circle cx='33' cy='16' r='2' fill='white' opacity={0.9} />
		</svg>
	);
}

export function VennThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<circle cx='19' cy='16' r='11' fill='currentColor' opacity={0.45} />
			<circle cx='29' cy='16' r='11' fill='currentColor' opacity={0.45} />
		</svg>
	);
}

export function TimelineThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<path d='M4 16 L44 16' stroke='currentColor' strokeWidth='1.5' opacity={0.5} />
			<circle cx='10' cy='16' r='3' fill='currentColor' opacity={0.7} />
			<circle cx='24' cy='16' r='3' fill='currentColor' opacity={0.7} />
			<circle cx='38' cy='16' r='3' fill='currentColor' opacity={0.7} />
			<rect x='6' y='4' width='8' height='6' rx='1' fill='currentColor' opacity={0.5} />
			<rect x='34' y='4' width='8' height='6' rx='1' fill='currentColor' opacity={0.5} />
		</svg>
	);
}

export function RelationshipThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<circle cx='14' cy='16' r='10' fill='currentColor' opacity={0.5} />
			<circle cx='34' cy='16' r='10' fill='currentColor' opacity={0.5} />
			<path d='M14 6 L34 26 M34 6 L14 26' stroke='currentColor' strokeWidth='1' opacity={0.3} />
		</svg>
	);
}

export function ChevronThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<path d='M2 8 L14 8 L20 16 L14 24 L2 24 L8 16 Z' fill='currentColor' opacity={0.7} />
			<path d='M17 8 L29 8 L35 16 L29 24 L17 24 L23 16 Z' fill='currentColor' opacity={0.7} />
			<path d='M32 8 L44 8 L44 24 L32 24 L38 16 Z' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export function BendingThumb(): React.ReactElement {
	return (
		<svg viewBox='0 0 48 32' className='w-full h-full'>
			<rect x='2' y='3' width='11' height='9' rx='2' fill='currentColor' opacity={0.7} />
			<path
				d='M13 7 L20 7 L20 16'
				stroke='currentColor'
				strokeWidth='1.5'
				fill='none'
				opacity={0.5}
			/>
			<rect x='19' y='12' width='11' height='9' rx='2' fill='currentColor' opacity={0.7} />
			<path
				d='M30 16 L37 16 L37 25'
				stroke='currentColor'
				strokeWidth='1.5'
				fill='none'
				opacity={0.5}
			/>
			<rect x='35' y='21' width='11' height='9' rx='2' fill='currentColor' opacity={0.7} />
		</svg>
	);
}

export const THUMB_COMPONENTS: Record<string, () => React.ReactElement> = {
	process: ProcessThumb,
	hierarchy: HierarchyThumb,
	cycle: CycleThumb,
	matrix: MatrixThumb,
	pyramid: PyramidThumb,
	list: ListThumb,
	funnel: FunnelThumb,
	target: TargetThumb,
	gear: GearThumb,
	venn: VennThumb,
	timeline: TimelineThumb,
	relationship: RelationshipThumb,
	chevron: ChevronThumb,
	bending: BendingThumb,
};
