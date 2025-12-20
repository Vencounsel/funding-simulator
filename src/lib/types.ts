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

export type Event = Safe | PricedRound | Options | ConvertibleNote | Accelerator;

export type Safe = {
	type: 'safe';
	valCap: number;
	mfn: boolean;
	proRata: boolean;
	discount: number;
	amount: number;
	name: string;
	accelerator?: string;  // Optional: name of accelerator program if this SAFE came from an accelerator preset
};

export type ConvertibleNote = {
	type: 'convertible';
	amount: number;          // Principal amount
	interestRate: number;    // Annual interest rate (e.g., 5 for 5%)
	term: number;            // Term in months until maturity
	valCap: number;          // Valuation cap
	discount: number;        // Discount percentage
	proRata: boolean;        // Pro-rata rights
	mfn: boolean;            // Most Favored Nation provision
	name: string;
};

export type PricedRound = {
	type: 'priced';
	valuation: number;
	proRata: boolean;
	options: number;
	amount: number;
	name: string;
	participations: string[];
	monthsToRound: number;  // Months from start until this round (for convertible note interest calculation)
};

export type Options = {
	type: 'options';
	amount: number;
	reserved: number;
	grantName: string;  // Name of recipient (e.g., "CTO", "Advisor 1") - empty string means generic "Employees"
};

export type Accelerator = {
	type: 'accelerator';
	name: string;           // Accelerator name (e.g., "MassChallenge")
	programName: string;    // Display name for the program
	amount: number;         // Funding amount (prize money, grants, etc.)
};

// types
export type Line = {
	label: string;
	shares: number;
};

export type CapTable = {
	[key: string]: number;
};
