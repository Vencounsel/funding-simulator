<script lang="ts">
	import { cn, formatAmount } from '$lib';
	import {
		AVAILABLE_OPTIONS_LABEL,
		EMPLOYEE_OPTIONS_LABEL,
		getTableTotalShares
	} from '$lib/calculations';
	import { events, founders, tables } from '$lib/store';
	import { get } from 'svelte/store';
	import type { Safe, Accelerator } from '$lib/types';

	export let position: number;
	export let valuation: number | undefined = undefined;

	$: lastTable = $tables[position];

	$: table = $tables[position + 1];

	$: getEquity = (shares: number) => {
		const total = getTableTotalShares(table);
		return (shares / total) * 100;
	};

	$: getDiff = (shares: number, previousShares: number) => {
		const total = getTableTotalShares(table);
		const previousTotal = getTableTotalShares(lastTable);
		return (shares / total) * 100 - (previousShares / previousTotal) * 100;
	};

	$: getValue = (equityPercent: number) => {
		if (!valuation) return null;
		return (equityPercent / 100) * valuation;
	};

	// Get accelerator mappings from events up to current position
	$: acceleratorMap = (() => {
		const map: { [safeName: string]: string } = {};
		$events.slice(0, position + 1).forEach((e) => {
			if (e.type === 'safe' && e.accelerator) {
				map[e.name] = e.accelerator;
			}
		});
		return map;
	})();

	// Get equity-free accelerators (Accelerator type events) up to current position
	$: equityFreeAccelerators = $events
		.slice(0, position + 1)
		.filter((e): e is Accelerator => e.type === 'accelerator')
		.map((e) => e.programName);

	$: lines = Object.keys(table).map((k) => ({
		label: k,
		equity: getEquity(table[k]),
		diff: getDiff(table[k], lastTable?.[k] || 0),
		accelerator: acceleratorMap[k] || null,
		type: get(founders)
			.map((f) => f.name)
			.includes(k)
			? 'founder'
			: [AVAILABLE_OPTIONS_LABEL, EMPLOYEE_OPTIONS_LABEL].includes(k)
				? 'options'
				: 'other'
	}));

	$: foundersLines = lines.filter((l) => l.type === 'founder');

	// Group investors by accelerator
	$: investorsLines = (() => {
		const otherLines = lines.filter((l) => l.type === 'other');
		const acceleratorGroups: { [accelerator: string]: { equity: number; diff: number; labels: string[] } } = {};
		const nonAcceleratorLines: typeof otherLines = [];

		otherLines.forEach((line) => {
			if (line.accelerator) {
				if (!acceleratorGroups[line.accelerator]) {
					acceleratorGroups[line.accelerator] = { equity: 0, diff: 0, labels: [] };
				}
				acceleratorGroups[line.accelerator].equity += line.equity;
				acceleratorGroups[line.accelerator].diff += line.diff;
				acceleratorGroups[line.accelerator].labels.push(line.label);
			} else {
				nonAcceleratorLines.push(line);
			}
		});

		// Convert accelerator groups to lines
		const acceleratorLines = Object.entries(acceleratorGroups).map(([accelerator, data]) => ({
			label: accelerator,
			equity: data.equity,
			diff: data.diff,
			accelerator: accelerator,
			type: 'other' as const,
			isAcceleratorGroup: true
		}));

		// Add equity-free accelerators that aren't already in the table
		const existingAccelerators = new Set(Object.keys(acceleratorGroups));
		const equityFreeLines = equityFreeAccelerators
			.filter((name) => !existingAccelerators.has(name))
			.map((name) => ({
				label: name,
				equity: 0,
				diff: 0,
				accelerator: name,
				type: 'other' as const,
				isAcceleratorGroup: true
			}));

		return [...acceleratorLines, ...equityFreeLines, ...nonAcceleratorLines];
	})();

	$: optionsLines = lines.filter((l) => l.type === 'options');
</script>

<div class="flex flex-col items-center z-[1] w-max max-sm:w-full max-sm:max-w-[340px]">
	<div class="flex flex-col text-sm rounded-lg border-[3px] p-3 py-2 border-borderLight bg-white shadow-lg">
		<!-- Column Headers -->
		<div class="flex text-[10px] gap-6 justify-between px-2 -mx-2 pb-1 mb-1 border-b border-borderLight text-textLight uppercase tracking-wide">
			<div class="shrink-0 min-w-[70px]"></div>
			<div>Equity</div>
			{#if valuation}
				<div class="w-[70px] text-right">Value</div>
			{/if}
			<div class="w-[45px] text-right">Chg</div>
		</div>
		{#each foundersLines as line}
			<div
				class="group/line hover:bg-borderLight p-0.5 px-2 -mx-2 flex text-xs gap-6 justify-between border-borderLight last:border-none"
			>
				<div
					class={cn(
						'shrink-0 min-w-[70px]',
						line.label === 'You' ? 'text-primary' : 'text-textDark'
					)}
				>
					{line.label}
				</div>
				<div class={cn(line.label === 'You' ? 'text-primary' : 'text-textDark')}>
					{line.equity.toFixed(1)}%
				</div>
				{#if valuation}
					<div class={cn('w-[70px] text-right', line.label === 'You' ? 'text-primary' : 'text-textDark')}>
						{formatAmount(Math.round(getValue(line.equity) || 0))}
					</div>
				{/if}
				<div
					class={cn(
						'w-[45px] text-right text-red-600 opacity-40 group-hover/line:opacity-100',
						line.diff > 0 && 'text-green-600',
						(line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0') &&
							'text-textLight text-center'
					)}
				>
					{#if line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0'}
						—
					{:else}
						{line.diff > 0 ? '+' : ''}{line.diff.toFixed(1)}%
					{/if}
				</div>
			</div>
		{/each}
		{#if investorsLines.length}
			<div
				class="relative w-full flex-1 text-[10px] uppercase [letter-spacing:0.5px] text-textLight"
			>
				<div class="absolute h-[2px] bg-borderDark w-full top-[50%] left-0" />

				<div class="mx-auto w-fit relative z-[2] bg-bg p-1">Investors</div>
			</div>
		{/if}
		{#each investorsLines as line}
			<div
				class="group/line hover:bg-borderLight p-0.5 px-2 -mx-2 flex text-xs gap-6 justify-between border-borderLight last:border-none"
			>
				<div class="shrink-0 min-w-[70px] text-textDark">
					{line.label}
				</div>
				<div class="text-textDark">
					{line.equity.toFixed(1)}%
				</div>
				{#if valuation}
					<div class="w-[70px] text-right text-textDark">
						{formatAmount(Math.round(getValue(line.equity) || 0))}
					</div>
				{/if}
				<div
					class={cn(
						'w-[45px] text-right text-red-600 opacity-40 group-hover/line:opacity-100',
						line.diff > 0 && 'text-green-600',
						(line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0') &&
							'text-textLight text-center'
					)}
				>
					{#if line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0'}
						—
					{:else}
						{line.diff > 0 ? '+' : ''}{line.diff.toFixed(1)}%
					{/if}
				</div>
			</div>
		{/each}
		{#if optionsLines.length}
			<div
				class="relative w-full flex-1 text-[10px] uppercase [letter-spacing:0.5px] text-textLight"
			>
				<div class="absolute h-[2px] bg-borderDark w-full top-[50%] left-0" />

				<div class="mx-auto w-fit relative z-[2] bg-bg p-1">Options</div>
			</div>
		{/if}
		{#each optionsLines as line}
			<div
				class="group/line hover:bg-borderLight p-0.5 px-2 -mx-2 flex text-xs gap-6 justify-between border-borderLight last:border-none"
			>
				<div class="shrink-0 min-w-[70px] text-textDark">
					{line.label}
				</div>
				<div class="text-textDark">
					{line.equity.toFixed(1)}%
				</div>
				{#if valuation}
					<div class="w-[70px] text-right text-textDark">
						{formatAmount(Math.round(getValue(line.equity) || 0))}
					</div>
				{/if}
				<div
					class={cn(
						'w-[45px] text-right text-red-600 opacity-40 group-hover/line:opacity-100',
						line.diff > 0 && 'text-green-600',
						(line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0') &&
							'text-textLight text-center'
					)}
				>
					{#if line.diff.toFixed(1) === '0.0' || line.diff.toFixed(1) === '-0.0'}
						—
					{:else}
						{line.diff > 0 ? '+' : ''}{line.diff.toFixed(1)}%
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
