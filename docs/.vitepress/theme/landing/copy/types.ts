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

export interface LandingLiveDemoCopy {
	kicker: string;
	title: string;
	copy: string;
	/** aria-label for the framework tablist. */
	frameworkLabel: string;
	soloTab: string;
	collabTab: string;
	/** Label for the guest-framework picker in collaboration mode. */
	guestPicker: string;
	load: string;
	loading: string;
	openFull: string;
	hostLabel: string;
	guestLabel: string;
	soloHint: string;
	collabHint: string;
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
	demos: LandingLiveDemoCopy;
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
