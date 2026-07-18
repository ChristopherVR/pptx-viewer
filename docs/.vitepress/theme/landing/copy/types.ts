export interface LandingLink {
	text: string;
	href: string;
}

export interface LandingFeatureCopy {
	title: string;
	copy: string;
	link: LandingLink;
}

export interface LandingFaqItem {
	q: string;
	a: string;
	link?: LandingLink;
}

export interface LandingFooterLink extends LandingLink {
	external?: boolean;
}

export interface LandingFooterColumn {
	title: string;
	links: LandingFooterLink[];
}

export interface LandingDemoCard {
	name: string;
	desc: string;
	href: string;
	external?: boolean;
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
		copyLabel: string;
		copiedLabel: string;
	};
	features: {
		kicker: string;
		title: string;
		items: LandingFeatureCopy[];
	};
	agents: {
		kicker: string;
		title: string;
		copy: string;
		link: LandingLink;
	};
	quickstart: {
		kicker: string;
		title: string;
		copy: string;
		docsLabel: string;
	};
	demos: {
		kicker: string;
		title: string;
		copy: string;
		open: string;
		cards: LandingDemoCard[];
	};
	faq: {
		kicker: string;
		title: string;
		items: LandingFaqItem[];
	};
	finale: {
		kicker: string;
		title: string;
		sub: string;
		quick: LandingLink;
		github: string;
		columns: LandingFooterColumn[];
		bottomLeft: string;
		bottomRight: string;
	};
}
