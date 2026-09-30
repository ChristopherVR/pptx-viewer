/** Trusted, shared SVG paths. No host-supplied markup is inserted into the icon. */
export const RIBBON_ICON_PATHS: Readonly<Record<string, string>> = {
	'play-start': 'M4 3 15 10 4 17ZM17 3v14',
	play: 'M5 3 16 10 5 17Z',
	presentation: 'M2 3h16v11H2ZM7 18h6M10 14v4',
	list: 'M4 4h12v12H4ZM7 8h6M7 11h6',
	broadcast:
		'M7 7a4.2 4.2 0 0 0 0 6M13 7a4.2 4.2 0 0 1 0 6M4.5 4.5a7.8 7.8 0 0 0 0 11M15.5 4.5a7.8 7.8 0 0 1 0 11M8.5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
	video: 'M2 5h11v10H2ZM13 10l5-3v6Z',
	settings: 'M3 5h14M6 10h8M8 15h4M6 3v4M12 8v4M10 13v4',
	'eye-off': 'M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5ZM4 4l12 12',
	clock: 'M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0M10 6v4l3 2',
	record: 'M5 10a5 5 0 1 0 10 0 5 5 0 1 0-10 0',
	captions: 'M2 4h16v12H2ZM5 9h4M11 9h4M5 12h3M10 12h5',
};
