export type Founder = {
	id: string;
	name: string;
	equity: number;
	isYou: boolean;
};

export type Exit = {
	amount: number;
	tax: number;
};

export type Event = Safe | PricedRound | Options | ConvertibleNote;

export type Safe = {
	type: 'safe';
	valCap: number;
	mfn: boolean;
	proRata: boolean;
	discount: number;
	amount: number;
	name: string;
};

export type ConvertibleNote = {
	type: 'convertible';
	amount: number;          // Principal amount
	interestRate: number;    // Annual interest rate (e.g., 5 for 5%)
	term: number;            // Term in months until maturity
	valCap: number;          // Valuation cap
	discount: number;        // Discount percentage
	proRata: boolean;        // Pro-rata rights
	name: string;
};

export type PricedRound = {
	type: 'priced';
	valuation: number;
	proRata: boolean;
	options: number;
	amount: number;
	name: string;
	participations: string[]
};

export type Options = {
	type: 'options';
	amount: number;
	reserved: number;
};

// types
export type Line = {
	label: string;
	shares: number;
};

export type CapTable = {
	[key: string]: number;
};
