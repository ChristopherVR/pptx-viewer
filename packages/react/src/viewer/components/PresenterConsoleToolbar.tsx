import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';
import {
	LuCirclePause,
	LuCirclePlay,
	LuEraser,
	LuGrid2X2,
	LuHighlighter,
	LuMonitor,
	LuMonitorOff,
	LuMousePointer2,
	LuPenTool,
	LuRotateCcw,
	LuScan,
	LuCaptions,
	LuX,
	LuZoomIn,
	LuZoomOut,
} from 'react-icons/lu';

export interface PresenterConsoleToolbarProps {
	snapshot: PresentationSnapshot;
	audienceOpen: boolean;
	onToggleAudience: () => void;
	onSwapDisplays: () => void;
	onToggleTimer: () => void;
	onResetTimer: () => void;
	onShowSlides: () => void;
	onStepZoom: (direction: 1 | -1) => void;
	onResetZoom: () => void;
	onBlackout: (value: PresentationSnapshot['blackout']) => void;
	onPointerTool: (tool: PresentationPointerTool) => void;
	onToggleSubtitles: () => void;
	onExit: () => void;
}

const toolClass = (active: boolean): string =>
	`inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md px-2 text-xs transition-colors ${
		active ? 'bg-sky-500 text-slate-950' : 'bg-white/7 text-slate-200 hover:bg-white/14'
	}`;

export function PresenterConsoleToolbar(props: PresenterConsoleToolbarProps) {
	const pointerTool = props.snapshot.pointer?.tool ?? 'none';
	const zoom = props.snapshot.zoom?.scale ?? 1;
	return (
		<div className='flex flex-wrap items-center gap-1 border-b border-white/10 bg-slate-950 px-3 py-2'>
			<button
				className={toolClass(false)}
				onClick={props.onToggleTimer}
				title='Pause or resume timer'
			>
				{props.snapshot.paused ? <LuCirclePlay /> : <LuCirclePause />}
			</button>
			<button className={toolClass(false)} onClick={props.onResetTimer} title='Reset timer'>
				<LuRotateCcw />
			</button>
			<span className='mx-1 h-6 w-px bg-white/15' />
			<button className={toolClass(false)} onClick={props.onShowSlides} title='See all slides'>
				<LuGrid2X2 /> Slides
			</button>
			<button className={toolClass(zoom > 1)} onClick={() => props.onStepZoom(1)} title='Zoom in'>
				<LuZoomIn />
			</button>
			<button className={toolClass(false)} onClick={() => props.onStepZoom(-1)} title='Zoom out'>
				<LuZoomOut />
			</button>
			<button className={toolClass(false)} onClick={props.onResetZoom} title='Reset zoom'>
				<LuScan />
			</button>
			<span className='mx-1 h-6 w-px bg-white/15' />
			{(['laser', 'pen', 'highlighter', 'eraser'] as const).map((tool) => (
				<button
					key={tool}
					className={toolClass(pointerTool === tool)}
					onClick={() => props.onPointerTool(pointerTool === tool ? 'none' : tool)}
					title={tool[0].toUpperCase() + tool.slice(1)}
				>
					{tool === 'laser' ? (
						<LuMousePointer2 />
					) : tool === 'pen' ? (
						<LuPenTool />
					) : tool === 'highlighter' ? (
						<LuHighlighter />
					) : (
						<LuEraser />
					)}
				</button>
			))}
			<span className='mx-1 h-6 w-px bg-white/15' />
			<button
				className={toolClass(props.snapshot.blackout === 'black')}
				onClick={() => props.onBlackout(props.snapshot.blackout === 'black' ? 'none' : 'black')}
				title='Black screen'
			>
				B
			</button>
			<button
				className={toolClass(props.snapshot.blackout === 'white')}
				onClick={() => props.onBlackout(props.snapshot.blackout === 'white' ? 'none' : 'white')}
				title='White screen'
			>
				W
			</button>
			<button
				className={toolClass(Boolean(props.snapshot.subtitlesVisible))}
				onClick={props.onToggleSubtitles}
				title='Toggle subtitles'
			>
				<LuCaptions />
			</button>
			<div className='flex-1' />
			<button
				className={toolClass(props.audienceOpen)}
				onClick={props.onToggleAudience}
				title='Audience display'
			>
				{props.audienceOpen ? <LuMonitorOff /> : <LuMonitor />}
			</button>
			<button
				className={toolClass(false)}
				onClick={props.onSwapDisplays}
				disabled={!props.audienceOpen}
				title='Swap displays'
			>
				Swap
			</button>
			<button className={toolClass(false)} onClick={props.onExit} title='End slide show'>
				<LuX /> End
			</button>
		</div>
	);
}
