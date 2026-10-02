/** Trusted 16x16 stroke paths for the title bar. No host markup is inserted. */
export const TITLE_BAR_ICON_PATHS: Readonly<Record<string, string>> = {
	save: 'M3 2.5h8l2 2v9H3zM5 2.5v4h5v-4M5 13.5v-4h6v4',
	undo: 'M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H8',
	redo: 'M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H8',
	play: 'M4.5 3v10l8-5z',
	printer: 'M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z',
	fileDown: 'M9 2H4.5v12h7V4.5zM9 2v2.5h2.5M8 6.5v4M6.3 8.8 8 10.5l1.7-1.7',
	plus: 'M8 3.5v9M3.5 8h9',
	spellCheck: 'M2 10.5 4.5 4l2.5 6.5M3 8.5h3M8 9.5l2 2 4-5',
	zoomIn: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.8 10.8 14 14M7 5v4M5 7h4',
	zoomOut: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.8 10.8 14 14M5 7h4',
	search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.8 10.8 14 14',
};
