export interface PresentationSnapshot {
	slideIndex: number;
	buildStep: number;
	sequence: number;
	blackout: 'none' | 'black' | 'white';
	paused: boolean;
	elapsedMs: number;
	zoom?: PresentationZoomState;
	pointer?: PresentationPointerState;
	inkStrokes?: PresentationInkStroke[];
	caption?: string;
	subtitlesVisible?: boolean;
}

export interface PresentationZoomState {
	scale: number;
	originX: number;
	originY: number;
}

export type PresentationPointerTool = 'none' | 'laser' | 'pen' | 'highlighter' | 'eraser';

export interface PresentationPointerState {
	tool: PresentationPointerTool;
	x: number;
	y: number;
	color: string;
}

export interface PresentationInkPoint {
	x: number;
	y: number;
}

export interface PresentationInkStroke {
	id: string;
	slideIndex: number;
	tool: 'pen' | 'highlighter';
	color: string;
	width: number;
	points: PresentationInkPoint[];
}

export interface PresentationAudienceReadyMessage {
	origin: 'pptx-viewer-presenter';
	type: 'audience-ready';
	sessionId: string;
}

export interface PresentationStateMessage {
	origin: 'pptx-viewer-presenter';
	type: 'presenter-state';
	sessionId: string;
	snapshot: PresentationSnapshot;
}

export interface PresentationSlideChangeMessage {
	origin: 'pptx-viewer-presenter';
	type: 'presenter-slide-change';
	sessionId: string;
	slideIndex: number;
}

export interface PresentationExitMessage {
	origin: 'pptx-viewer-presenter';
	type: 'presenter-exit';
	sessionId: string;
}

export type PresentationSessionMessage =
	| PresentationAudienceReadyMessage
	| PresentationStateMessage
	| PresentationSlideChangeMessage
	| PresentationExitMessage;
