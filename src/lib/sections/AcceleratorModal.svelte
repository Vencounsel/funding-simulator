<script lang="ts">
	import { cn, formatAmount } from '$lib';
	import { events } from '$lib/store';
	import { onMount } from 'svelte';
	import type { Accelerator, Safe } from '$lib/types';

	export let position: number;
	export let onClose: () => void;

	// Accelerator presets with verified 2024-2025 deal terms
	const ACCELERATOR_PRESETS = [
		{ name: 'Y Combinator', investment: 500_000, equity: 7, equityFree: false, description: '$125K for 7% + $375K MFN SAFE' },
		{ name: 'Techstars', investment: 220_000, equity: 5, equityFree: false, description: '$20K for 5% + $200K MFN SAFE' },
		{ name: 'a16z Speedrun', investment: 500_000, equity: 10, equityFree: false, description: '$500K post-money SAFE' },
		{ name: '500 Global', investment: 150_000, equity: 6, equityFree: false, description: '$150K post-money SAFE' },
		{ name: 'Antler', investment: 125_000, equity: 10, equityFree: false, description: '$125K post-money SAFE' },
		{ name: 'SOSV/HAX', investment: 250_000, equity: 10, equityFree: false, description: '$250K post-money SAFE' },
		{ name: 'MassChallenge', investment: 100_000, equity: 0, equityFree: true, description: 'Equity-free grant/prize' }
	];

	let selectedPreset = ACCELERATOR_PRESETS[0];
	let showDropdown = false;
	let modalRef: HTMLDivElement;

	onMount(() => {
		const handleClick = (e: MouseEvent) => {
			if (modalRef && !modalRef.contains(e.target as Node)) {
				onClose();
			}
		};

		document.addEventListener('click', handleClick, true);
		return () => document.removeEventListener('click', handleClick, true);
	});

	const addAccelerator = () => {
		if (selectedPreset.equityFree) {
			// Create equity-free accelerator event
			const acceleratorEvent: Accelerator = {
				type: 'accelerator',
				name: selectedPreset.name,
				programName: selectedPreset.name,
				amount: selectedPreset.investment
			};
			$events = [
				...$events.slice(0, position),
				acceleratorEvent,
				...$events.slice(position)
			];
		} else if (selectedPreset.name === 'Y Combinator') {
			// Y Combinator has a special two-SAFE structure
			const ycSafe125k: Safe = {
				type: 'safe',
				amount: 125_000,
				discount: 0,
				mfn: false,
				name: 'YC $125K',
				proRata: true,
				valCap: Math.round(125_000 / 0.07),
				accelerator: 'Y Combinator'
			};
			const ycSafeMFN: Safe = {
				type: 'safe',
				amount: 375_000,
				discount: 0,
				mfn: true,
				name: 'YC MFN',
				proRata: true,
				valCap: 0,
				accelerator: 'Y Combinator'
			};
			$events = [
				...$events.slice(0, position),
				ycSafe125k,
				ycSafeMFN,
				...$events.slice(position)
			];
		} else if (selectedPreset.name === 'Techstars') {
			// Techstars has a two-part structure
			const tsCEA: Safe = {
				type: 'safe',
				amount: 20_000,
				discount: 0,
				mfn: false,
				name: 'Techstars CEA',
				proRata: true,
				valCap: Math.round(20_000 / 0.05),
				accelerator: 'Techstars'
			};
			const tsMFN: Safe = {
				type: 'safe',
				amount: 200_000,
				discount: 0,
				mfn: true,
				name: 'Techstars MFN',
				proRata: true,
				valCap: 0,
				accelerator: 'Techstars'
			};
			$events = [
				...$events.slice(0, position),
				tsCEA,
				tsMFN,
				...$events.slice(position)
			];
		} else {
			// Create SAFE with calculated valuation cap
			const valCap = Math.round(selectedPreset.investment / (selectedPreset.equity / 100));
			const safeEvent: Safe = {
				type: 'safe',
				amount: selectedPreset.investment,
				discount: 0,
				mfn: false,
				name: selectedPreset.name,
				proRata: true,
				valCap: valCap,
				accelerator: selectedPreset.name
			};
			$events = [
				...$events.slice(0, position),
				safeEvent,
				...$events.slice(position)
			];
		}
		onClose();
	};
</script>

<!-- Backdrop overlay -->
<div class="fixed inset-0 bg-black/20 z-20" />

<!-- Modal -->
<div
	bind:this={modalRef}
	class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-sm:w-[350px] bg-white border border-white rounded-2xl shadow-lg z-[21]"
>
	<!-- Header -->
	<div class="bg-bg flex justify-between items-center h-[54px] px-6 rounded-t-2xl">
		<span class="text-primary text-lg">Add Accelerator</span>
		<button
			on:click={onClose}
			class="text-textLight hover:text-textDark p-1"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		</button>
	</div>

	<!-- Content -->
	<div class="p-6 border-y-[3px] border-borderLight">
		<!-- Dropdown -->
		<div class="mb-4">
			<div class="text-sm text-textLight mb-2">Select Accelerator</div>
			<div class="relative">
				<button
					on:click={() => showDropdown = !showDropdown}
					class="w-full h-11 px-4 bg-bg border border-borderLight rounded-lg flex items-center justify-between hover:border-borderDark transition-colors"
				>
					<span class="text-textDark">{selectedPreset.name}</span>
					<svg
						class={cn('w-4 h-4 text-textLight transition-transform', showDropdown && 'rotate-180')}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if showDropdown}
					<div class="absolute top-full left-0 right-0 mt-1 bg-white border border-borderLight rounded-lg shadow-lg z-10 max-h-[240px] overflow-y-auto">
						{#each ACCELERATOR_PRESETS as preset}
							<button
								on:click={() => {
									selectedPreset = preset;
									showDropdown = false;
								}}
								class={cn(
									'w-full px-4 py-3 flex items-center justify-between hover:bg-bg transition-colors border-b border-borderLight last:border-none text-left',
									selectedPreset.name === preset.name && 'bg-bg'
								)}
							>
								<span class="text-textDark">{preset.name}</span>
								<span class="text-textLight text-sm">
									{preset.equityFree ? '0%' : `${preset.equity}%`}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Terms Preview -->
		<div class="bg-bg rounded-lg p-4">
			<div class="text-sm text-textLight mb-3">Deal Terms</div>
			<div class="space-y-2">
				<div class="flex justify-between">
					<span class="text-textLight text-sm">Investment</span>
					<span class="text-textDark text-sm font-medium">{formatAmount(selectedPreset.investment)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-textLight text-sm">Equity</span>
					<span class={cn(
						'text-sm font-medium',
						selectedPreset.equityFree ? 'text-green-600' : 'text-textDark'
					)}>
						{selectedPreset.equityFree ? 'None (equity-free)' : `${selectedPreset.equity}%`}
					</span>
				</div>
				{#if !selectedPreset.equityFree}
					<div class="flex justify-between">
						<span class="text-textLight text-sm">Implied Valuation</span>
						<span class="text-textDark text-sm font-medium">
							{formatAmount(Math.round(selectedPreset.investment / (selectedPreset.equity / 100)))}
						</span>
					</div>
				{/if}
			</div>
			<div class="mt-3 pt-3 border-t border-borderLight">
				<span class="text-textLight text-xs">{selectedPreset.description}</span>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div class="p-4 flex justify-end gap-3">
		<button
			on:click={onClose}
			class="px-4 py-2 text-sm text-textLight hover:text-textDark transition-colors"
		>
			Cancel
		</button>
		<button
			on:click={addAccelerator}
			class="px-6 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
		>
			Add
		</button>
	</div>
</div>
