/** Trusted 16x16 stroke paths for the status bar. No host markup is inserted. */
export const STATUS_BAR_ICON_PATHS = {
	notes: 'M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4',
	normal: 'M2.5 3.5h11v8h-11zM6 12.5h4',
	sorter: 'M2.5 3.5h4v4h-4zM9.5 3.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z',
	slideShow: 'M2 3h12M13 3v6.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3M6 14l2-2.5 2 2.5',
	zoomOut: 'M3.5 8h9',
	zoomIn: 'M8 3.5v9M3.5 8h9',
} as const;

export type StatusBarIcon = keyof typeof STATUS_BAR_ICON_PATHS;
