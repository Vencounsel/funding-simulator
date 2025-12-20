import { get } from 'svelte/store';
import { events as _events, founders as _founders, exit as _exit } from './store';
import { produce } from 'immer';
import type { CapTable, ConvertibleNote, Event, Options, PricedRound, Safe } from './types';

const INITIAL_SHARES = 10_000_000;
export const AVAILABLE_OPTIONS_LABEL = 'Available';
export const EMPLOYEE_OPTIONS_LABEL = 'Employees';

const getNewOptions = ({
	currentShares,
	optionsTaget,
	existingAvailableOptions,
	newInvestment,
	preMoneyValuation
}: {
	currentShares: number;
	optionsTaget: number;
	existingAvailableOptions: number;
	newInvestment: number;
	preMoneyValuation: number;
}) => {
	const f1 = 1 / optionsTaget - 1;

	const top =
		(currentShares / f1) * (1 + newInvestment / preMoneyValuation) -
		existingAvailableOptions / (1 - optionsTaget);

	const bottom = 1 - newInvestment / (preMoneyValuation * f1);

	return top / bottom;
};

export const getTableTotalShares = (table: CapTable) => {
	return table ? Object.values(table).reduce((prev, curr) => {
		return prev + curr;
	}, 0) : 0;
};

const getFirstTable = (): CapTable => {
	const founders = get(_founders);
	const table: CapTable = {};

	founders.forEach((founder) => {
		table[founder.name] = (founder.equity / 100) * INITIAL_SHARES;
	});

	return table;
};

// Check if convertibles (SAFEs + notes) exceed 100% dilution
export const getConvertiblesDilutionPercent = (firstPricedRound: PricedRound): number => {
	const safesBase = getSafesValuations(firstPricedRound);
	const notesBase = getConvertibleNotesValuations(firstPricedRound);

	const safesWithMFN = getSafesWithMFN(safesBase, notesBase);
	const notesWithMFN = getConvertibleNotesWithMFN(notesBase, safesBase);

	const totalSafesDilution = safesWithMFN.reduce((prev, curr) => {
		return prev + curr.amount / curr.valuation;
	}, 0);

	const totalNotesDilution = notesWithMFN.reduce((prev, curr) => {
		return prev + curr.totalAmount / curr.valuation;
	}, 0);

	return (totalSafesDilution + totalNotesDilution) * 100;
};

export const getSafesValuations = (firstPricedRound: PricedRound) => {
	const events = get(_events);
	return (events.filter((e) => e.type === 'safe') as Safe[]).map((safe) => {
		let valuation = firstPricedRound.valuation;
		if (safe.valCap && safe.discount)
			valuation = Math.min(safe.valCap, firstPricedRound.valuation * (1 - safe.discount / 100));
		if (safe.valCap && !safe.discount) valuation = safe.valCap;
		if (!safe.valCap && safe.discount)
			valuation = firstPricedRound.valuation * (1 - safe.discount / 100);
		// Track original position in events array for MFN ordering
		const eventIndex = events.findIndex((e) => e.type === 'safe' && e.name === safe.name);
		return {
			...safe,
			valuation,
			eventIndex
		} as Safe & { valuation: number; eventIndex: number };
	});
};

export const getSafesWithMFN = (
	safes: (Safe & { valuation: number; eventIndex: number })[],
	notes: (ConvertibleNote & { valuation: number; eventIndex: number })[] = []
) => safes.map((safe) => {
	if (!safe.mfn) return safe;
	// MFN looks at SAFEs and convertible notes issued AFTER this one
	// It picks up the most favorable terms (lowest effective valuation)
	const laterSafes = safes.filter((s) => s.eventIndex > safe.eventIndex);
	const laterNotes = notes.filter((n) => n.eventIndex > safe.eventIndex);
	const allLaterInstruments: { valuation: number }[] = [...laterSafes, ...laterNotes];
	if (allLaterInstruments.length === 0) return safe; // No later instruments, keep original valuation
	const lowestValuation = allLaterInstruments.reduce((min, current) => {
		return current.valuation < min ? current.valuation : min;
	}, safe.valuation);
	return {
		...safe,
		valuation: lowestValuation
	};
});

export const getSafes = (firstPricedRound: PricedRound, totalShares: number) => {
	const safesTables: CapTable = {};

	const notesValuations = getConvertibleNotesValuations(firstPricedRound);
	const safesWithMFN = getSafesWithMFN(getSafesValuations(firstPricedRound), notesValuations)

	const totalSafesDilution = safesWithMFN.reduce((prev, curr) => {
		return prev + curr.amount / curr.valuation;
	}, 0);

	// Cap total dilution to prevent negative equity (max 99.9% dilution from SAFEs)
	const cappedDilution = Math.min(totalSafesDilution, 0.999);
	const newTotal = totalShares / (1 - cappedDilution);

	// Calculate proportional shares when dilution is capped
	const dilutionRatio = cappedDilution / (totalSafesDilution || 1);

	safesWithMFN.forEach((safe) => {
		const effectiveDilution = (safe.amount / safe.valuation!) * dilutionRatio;
		safesTables[safe.name] = newTotal * effectiveDilution;
	});

	return safesTables;
};

// Calculate accrued interest for a convertible note (simple interest)
// If monthsToConversion is provided, use min(monthsToConversion, term) for interest calculation
export const getConvertibleNoteAccruedAmount = (note: ConvertibleNote, monthsToConversion?: number): number => {
	const effectiveMonths = monthsToConversion !== undefined
		? Math.min(monthsToConversion, note.term)
		: note.term;
	const accruedInterest = note.amount * (note.interestRate / 100) * (effectiveMonths / 12);
	return note.amount + accruedInterest;
};

// Get convertible notes with their valuations calculated
export const getConvertibleNotesValuations = (firstPricedRound: PricedRound) => {
	const events = get(_events);
	return (events.filter((e) => e.type === 'convertible') as ConvertibleNote[]).map((note) => {
		let valuation = firstPricedRound.valuation;
		// Use monthsToRound from priced round to calculate interest (converts at earlier of priced round or maturity)
		const totalAmount = getConvertibleNoteAccruedAmount(note, firstPricedRound.monthsToRound);

		if (note.valCap && note.discount)
			valuation = Math.min(note.valCap, firstPricedRound.valuation * (1 - note.discount / 100));
		if (note.valCap && !note.discount) valuation = note.valCap;
		if (!note.valCap && note.discount)
			valuation = firstPricedRound.valuation * (1 - note.discount / 100);

		// Track original position in events array for MFN ordering
		const eventIndex = events.findIndex((e) => e.type === 'convertible' && e.name === note.name);
		return {
			...note,
			valuation,
			totalAmount,  // Principal + accrued interest
			eventIndex
		} as ConvertibleNote & { valuation: number; totalAmount: number; eventIndex: number };
	});
};

// Apply MFN provision to convertible notes (similar to SAFEs)
// MFN finds the most favorable terms (lowest effective valuation) from later notes AND SAFEs
export const getConvertibleNotesWithMFN = (
	notes: (ConvertibleNote & { valuation: number; totalAmount: number; eventIndex: number })[],
	safes: (Safe & { valuation: number; eventIndex: number })[] = []
) =>
	notes.map((note) => {
		if (!note.mfn) return note;
		// MFN looks at notes and SAFEs issued AFTER this one
		const laterNotes = notes.filter((n) => n.eventIndex > note.eventIndex);
		const laterSafes = safes.filter((s) => s.eventIndex > note.eventIndex);
		const allLaterInstruments: { valuation: number }[] = [...laterNotes, ...laterSafes];
		if (allLaterInstruments.length === 0) return note; // No later instruments, keep original valuation
		const lowestValuation = allLaterInstruments.reduce((min, current) => {
			return current.valuation < min ? current.valuation : min;
		}, note.valuation);
		return {
			...note,
			valuation: lowestValuation
		};
	});

// Get convertible notes as shares at first priced round
export const getConvertibleNotes = (firstPricedRound: PricedRound, totalShares: number) => {
	const notesTables: CapTable = {};

	// Get base valuations first (before MFN)
	const safesBase = getSafesValuations(firstPricedRound);
	const notesBase = getConvertibleNotesValuations(firstPricedRound);

	// Apply MFN - each considers the other for most favorable terms
	const notesWithMFN = getConvertibleNotesWithMFN(notesBase, safesBase);
	const safesWithMFN = getSafesWithMFN(safesBase, notesBase);

	const totalNotesDilution = notesWithMFN.reduce((prev, curr) => {
		return prev + curr.totalAmount / curr.valuation;
	}, 0);

	const totalSafesDilution = safesWithMFN.reduce((prev, curr) => {
		return prev + curr.amount / curr.valuation;
	}, 0);

	// Cap total dilution to prevent negative equity (max 99.9% dilution from SAFEs/notes)
	const totalDilution = Math.min(totalSafesDilution + totalNotesDilution, 0.999);
	const newTotal = totalShares / (1 - totalDilution);

	// Calculate proportional shares for each note when dilution is capped
	const dilutionRatio = totalDilution / (totalSafesDilution + totalNotesDilution || 1);

	notesWithMFN.forEach((note) => {
		const effectiveDilution = (note.totalAmount / note.valuation) * dilutionRatio;
		notesTables[note.name] = newTotal * effectiveDilution;
	});

	return notesTables;
};

// Updated getSafes to account for convertible notes in dilution calculation
export const getSafesWithNotes = (firstPricedRound: PricedRound, totalShares: number) => {
	const safesTables: CapTable = {};

	// Get base valuations first (before MFN)
	const safesBase = getSafesValuations(firstPricedRound);
	const notesBase = getConvertibleNotesValuations(firstPricedRound);

	// Apply MFN - each considers the other for most favorable terms
	const notesWithMFN = getConvertibleNotesWithMFN(notesBase, safesBase);
	const safesWithMFN = getSafesWithMFN(safesBase, notesBase);

	const totalSafesDilution = safesWithMFN.reduce((prev, curr) => {
		return prev + curr.amount / curr.valuation;
	}, 0);

	const totalNotesDilution = notesWithMFN.reduce((prev, curr) => {
		return prev + curr.totalAmount / curr.valuation;
	}, 0);

	// Cap total dilution to prevent negative equity (max 99.9% dilution from SAFEs/notes)
	const totalDilution = Math.min(totalSafesDilution + totalNotesDilution, 0.999);
	const newTotal = totalShares / (1 - totalDilution);

	// Calculate proportional shares for each SAFE when dilution is capped
	const dilutionRatio = totalDilution / (totalSafesDilution + totalNotesDilution || 1);

	safesWithMFN.forEach((safe) => {
		const effectiveDilution = (safe.amount / safe.valuation!) * dilutionRatio;
		safesTables[safe.name] = newTotal * effectiveDilution;
	});

	return safesTables;
};

export const getProRatas = ({
	current,
	event,
	newShares,
	total,
	firstPricedRound,
	allEvents
}: {
	event: PricedRound;
	newShares: number;
	total: number;
	current: CapTable;
	firstPricedRound: boolean;
	allEvents: Event[]
}) => {
	let proRatas: CapTable = {};
	allEvents.forEach((e) => {

		if (e.type !== 'priced' && e.type !== 'safe' && e.type !== 'convertible') return;
		if ((e.type === 'safe' || e.type === 'convertible') && !firstPricedRound) return;
		if (!e.proRata || !current[e.name] || e.name === event.name) return;

		const shares = newShares * (current[e.name] / total);
		if (shares && event.participations.includes(e.name))
			proRatas = addTables(proRatas, {
				[e.name]: shares
			});
	});
	return proRatas;
};

const getOptions = ({
	current,
	event,
	total
}: {
	current: CapTable;
	event: Options;
	total: number;
}) => {
	const options: CapTable = {};
	if (event.reserved) {
		const target = event.reserved / 100;
		options[AVAILABLE_OPTIONS_LABEL] = (target * total) / (1 - target);
	}
	if(event.amount) {
		const target = event.amount / 100;
		if (target <= parseFloat((((current[AVAILABLE_OPTIONS_LABEL] || 0) + (options[AVAILABLE_OPTIONS_LABEL] || 0)) / total).toFixed(2))) {
			const sharesToGrant = (total + (options[AVAILABLE_OPTIONS_LABEL] || 0)) * target;
			const grantLabel = event.grantName || EMPLOYEE_OPTIONS_LABEL;
			options[grantLabel] = (options[grantLabel] || 0) + sharesToGrant;
			options[AVAILABLE_OPTIONS_LABEL] = (options[AVAILABLE_OPTIONS_LABEL] || 0) - sharesToGrant;
		}
	}

	return options;
};

export const addTables = (oldTable: CapTable, table: CapTable) => {
	return produce(oldTable, (draft) => {
		Object.keys(table).forEach((key) => {
			draft[key] = (draft[key] || 0) + table[key];
		});
	});
};

export const getNewTable = (event: Event, previousTable: CapTable, firstPricedRound: boolean) => {
	let newTable: CapTable = {};
	const oldTotal = getTableTotalShares(previousTable);
	const getCurrentTotal = () => getTableTotalShares(newTable) + oldTotal;

	if (event.type === 'priced') {
		let safes: CapTable = {};
		let notes: CapTable = {};
		if (firstPricedRound) {
			// Use the updated function that accounts for both SAFEs and convertible notes
			safes = getSafesWithNotes(event, oldTotal);
			notes = getConvertibleNotes(event, oldTotal);
			newTable = addTables(newTable, safes);
			newTable = addTables(newTable, notes);
		}
		let futureTotal = 0;
		let newOptions = 0;
		if (event.options) {
			const previousOptions = previousTable[AVAILABLE_OPTIONS_LABEL] || 0;
			newOptions = getNewOptions({
				currentShares: getCurrentTotal(),
				existingAvailableOptions: previousOptions,
				newInvestment: event.amount,
				optionsTaget: event.options / 100,
				preMoneyValuation: event.valuation - event.amount
			});

			futureTotal = (previousOptions + newOptions) / (event.options / 100);
		} else {
			futureTotal = getCurrentTotal() / (1 - event.amount / event.valuation);
		}

		const newShares = futureTotal - getCurrentTotal();

		const newInvestorsShares = newShares - newOptions;

		const proRatas = getProRatas({
			firstPricedRound,
			event,
			newShares: newInvestorsShares,
			current: addTables(previousTable, newTable),
			total: getCurrentTotal(),
			allEvents: get(_events)
		});

		const proRatasTotal = getTableTotalShares(proRatas);

		const mainInvestorShares = newInvestorsShares - proRatasTotal;

		newTable = addTables(newTable, proRatas);
		newTable = addTables(newTable, {
			[AVAILABLE_OPTIONS_LABEL]: newOptions
		});
		newTable = addTables(newTable, {
			[event.name]: mainInvestorShares
		});
	}

	if (event.type === 'options') {
		newTable = addTables(
			newTable,
			getOptions({ current: addTables(previousTable, newTable), event, total: getCurrentTotal() })
		);
	}

	return addTables(previousTable, newTable);
};

export const getCapTables = (): CapTable[] => {
	const events = get(_events);
	const exit = get(_exit);
	const tables: CapTable[] = [getFirstTable()];

	let foundFirstPricedRound = false;

	events.forEach((event) => {
		tables.push(
			getNewTable(
				event,
				tables[tables.length - 1],
				event.type === 'priced' && !foundFirstPricedRound
			)
		);
		if (event.type === 'priced') {
			foundFirstPricedRound = true;
		}
	});

	if (exit?.amount) {
		// distribute remaining available options
		const lastTable = tables[tables.length - 1];
		const distributedOptions: CapTable = {};
		const availableOptions = lastTable[AVAILABLE_OPTIONS_LABEL];
		if (availableOptions) {
			const total = getTableTotalShares(lastTable) - availableOptions;
			Object.keys(lastTable).forEach((key) => {
				if (key === AVAILABLE_OPTIONS_LABEL) {
					distributedOptions[AVAILABLE_OPTIONS_LABEL] = -availableOptions;
				} else {
					const newShares = (lastTable?.[key] / total) * availableOptions;
					distributedOptions[key] = newShares;
				}
			});
			tables.push(addTables(lastTable, distributedOptions));
		}
	}

	return tables;
};
