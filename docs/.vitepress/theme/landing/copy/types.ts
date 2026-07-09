export interface LandingLink {
	text: string;
	href: string;
}

export interface LandingPanelCopy {
	kicker: string;
	title: string;
	copy: string;
	link: LandingLink;
}

export interface LandingTileCopy {
	title: string;
	copy: string;
	href: string;
	wide?: boolean;
}

export interface LandingCopy {
	hero: {
		kicker: string;
		titleTop: string;
		titleAccent: string;
		sub: string;
		start: LandingLink;
		demo: string;
		scroll: string;
		frameCaption: string;
		frameTry: string;
	};
	statement: {
		kicker: string;
		line1: string;
		line2Pre: string;
		line2Em: string;
		line2Post: string;
		line3: string;
	};
	panels: LandingPanelCopy[];
	bento: {
		kicker: string;
		tiles: LandingTileCopy[];
	};
	stack: {
		kicker: string;
		title: string;
		copyPre: string;
		copyCode: string;
		copyPost: string;
		packages: Array<{ name: string; desc: string; href: string; external: boolean }>;
	};
	finale: {
		kicker: string;
		title: string;
		sub: string;
		quick: LandingLink;
		github: string;
		footLeft: string;
		footRight: string;
	};
}
