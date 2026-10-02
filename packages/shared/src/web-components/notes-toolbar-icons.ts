/** Trusted 24x24 stroke paths (Lucide geometry). No host markup is inserted. */
export const NOTES_TOOLBAR_ICON_PATHS = {
	bold: 'M6 4h8a4 4 0 0 1 0 8H6z M6 12h9a4 4 0 0 1 0 8H6z',
	italic: 'M19 4h-9 M14 20H5 M15 4 9 20',
	underline: 'M6 4v6a6 6 0 0 0 12 0V4 M4 20h16',
	strike: 'M16 4H9a3 3 0 0 0-2.83 4 M14 12a4 4 0 0 1 0 8H6 M4 12h16',
	bullet: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
	numbered: 'M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 18H4c0-1 2-1.5 2-2.5S5 14 4 14',
	indent: 'm3 8 4 4-4 4 M11 12h10 M11 6h10 M11 18h10',
	outdent: 'm7 8-4 4 4 4 M11 12h10 M11 6h10 M11 18h10',
	link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
	print:
		'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
} as const;

export type NotesToolbarIcon = keyof typeof NOTES_TOOLBAR_ICON_PATHS;
