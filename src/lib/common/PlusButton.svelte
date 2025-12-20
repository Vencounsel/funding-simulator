<script lang="ts">
	import { box, cn, generateNameForEvent, getDefaultPricedRoundAmount, menu } from '$lib';
	import PricedIcon from '$lib/icons/PricedIcon.svelte';
	import OptionsIcon from '$lib/icons/OptionsIcon.svelte';
	import ExitIcon from '$lib/icons/ExitIcon.svelte';
	import SafeIcon from '$lib/icons/SafeIcon.svelte';
	import NoteIcon from '$lib/icons/NoteIcon.svelte';
	import AcceleratorIcon from '$lib/icons/AcceleratorIcon.svelte';
	import { events, exit } from '$lib/store';
	import { onMount } from 'svelte';
	import type { Accelerator, ConvertibleNote, PricedRound, Safe } from '$lib/types';

	// Accelerator presets with verified 2024-2025 deal terms
	const ACCELERATOR_PRESETS = [
		{ name: 'Y Combinator', investment: 500_000, equity: 7, equityFree: false },
		{ name: 'Techstars', investment: 220_000, equity: 5, equityFree: false },
		{ name: 'a16z Speedrun', investment: 500_000, equity: 10, equityFree: false },
		{ name: '500 Global', investment: 150_000, equity: 6, equityFree: false },
		{ name: 'Antler', investment: 125_000, equity: 10, equityFree: false },
		{ name: 'SOSV/HAX', investment: 250_000, equity: 10, equityFree: false },
		{ name: 'MassChallenge', investment: 100_000, equity: 0, equityFree: true }
	];

	let ref: HTMLDivElement;

	onMount(() => {
		const handleClick = (e: MouseEvent) => {
			if (ref && !ref?.contains(e.target as Node)) {
				showMenu = false;
			}
		};

		document.addEventListener('click', handleClick, true);
		return () => document.removeEventListener('click', handleClick, true);
	});

	const addSafe = () => {
		showMenu = false;
		const name = generateNameForEvent('safe', position);
		$events = [
			...$events.slice(0, position),
			{
				type: 'safe',
				amount: 100_000,
				discount: 0,
				mfn: false,
				name,
				proRata: false,
				valCap: 2_000_000
			},
			...$events.slice(position)
		];
	};

	const addConvertibleNote = () => {
		showMenu = false;
		const name = generateNameForEvent('convertible', position);
		$events = [
			...$events.slice(0, position),
			{
				type: 'convertible',
				amount: 100_000,
				interestRate: 5,
				term: 18,
				valCap: 2_000_000,
				discount: 0,
				proRata: false,
				mfn: false,
				name
			},
			...$events.slice(position)
		];
	};

	$: getParticipations = () => {
		const previousPricedRounds = $events
			.slice(0, position)
			.filter((e) => e.type === 'priced') as PricedRound[];
		if (previousPricedRounds.length > 0) {
			const previousPricedRound = previousPricedRounds[previousPricedRounds.length - 1];
			if (previousPricedRound.proRata) {
				return [previousPricedRound.name];
			}
		} else {
			return ($events.slice(0, position).filter((e) => e.type === 'safe') as Safe[]).map(
				(e) => e.name
			);
		}
		return [];
	};

	const addPriced = () => {
		showMenu = false;
		const name = generateNameForEvent('priced', position);
		$events = [
			...$events.slice(0, position),
			{
				type: 'priced',
				amount: getDefaultPricedRoundAmount(name)[0] * 1_000_000,
				name,
				proRata: true,
				valuation: getDefaultPricedRoundAmount(name)[1] * 1_000_000,
				options: 10,
				participations: getParticipations(),
				monthsToRound: 12
			},
			...$events.slice(position)
		];
	};

	const addOptions = () => {
		showMenu = false;
		$events = [
			...$events.slice(0, position),
			{
				type: 'options',
				amount: 2,
				reserved: 10,
				grantName: ''
			},
			...$events.slice(position)
		];
	};

	let showMenu = false;
	let showAcceleratorSubmenu = false;

	const addAccelerator = (preset: typeof ACCELERATOR_PRESETS[0]) => {
		showMenu = false;
		showAcceleratorSubmenu = false;

		if (preset.equityFree) {
			// Create equity-free accelerator event
			const acceleratorEvent: Accelerator = {
				type: 'accelerator',
				name: preset.name,
				programName: preset.name,
				amount: preset.investment
			};
			$events = [
				...$events.slice(0, position),
				acceleratorEvent,
				...$events.slice(position)
			];
		} else if (preset.name === 'Y Combinator') {
			// Y Combinator has a special two-SAFE structure
			// 1. $125K post-money SAFE for 7% equity
			const ycSafe125k: Safe = {
				type: 'safe',
				amount: 125_000,
				discount: 0,
				mfn: false,
				name: 'YC $125K',
				proRata: true,
				valCap: Math.round(125_000 / 0.07), // ~$1.78M cap for 7%
				accelerator: 'Y Combinator'
			};
			// 2. $375K uncapped MFN SAFE
			const ycSafeMFN: Safe = {
				type: 'safe',
				amount: 375_000,
				discount: 0,
				mfn: true,
				name: 'YC MFN',
				proRata: true,
				valCap: 0, // Uncapped - will convert at lowest cap of other SAFEs
				accelerator: 'Y Combinator'
			};
			$events = [
				...$events.slice(0, position),
				ycSafe125k,
				ycSafeMFN,
				...$events.slice(position)
			];
		} else if (preset.name === 'Techstars') {
			// Techstars has a two-part structure (2025 terms)
			// 1. $20K CEA (Convertible Equity Agreement) for 5% common stock
			const tsCEA: Safe = {
				type: 'safe',
				amount: 20_000,
				discount: 0,
				mfn: false,
				name: 'Techstars CEA',
				proRata: true,
				valCap: Math.round(20_000 / 0.05), // $400K cap for 5%
				accelerator: 'Techstars'
			};
			// 2. $200K uncapped MFN SAFE
			const tsMFN: Safe = {
				type: 'safe',
				amount: 200_000,
				discount: 0,
				mfn: true,
				name: 'Techstars MFN',
				proRata: true,
				valCap: 0, // Uncapped - will convert at lowest cap of other SAFEs
				accelerator: 'Techstars'
			};
			$events = [
				...$events.slice(0, position),
				tsCEA,
				tsMFN,
				...$events.slice(position)
			];
		} else {
			// Create SAFE with calculated valuation cap based on equity %
			// Post-money valuation = investment / equity percentage
			const valCap = Math.round(preset.investment / (preset.equity / 100));
			const safeEvent: Safe = {
				type: 'safe',
				amount: preset.investment,
				discount: 0,
				mfn: false,
				name: preset.name,
				proRata: true, // Most accelerators have pro-rata rights
				valCap: valCap,
				accelerator: preset.name
			};
			$events = [
				...$events.slice(0, position),
				safeEvent,
				...$events.slice(position)
			];
		}
	};

	export let position: number;

	$: showExit =
		$events.slice(0, position).some((e) => e.type === 'priced') && position === $events.length;
	$: showSafe = !$events.slice(0, position).some((e) => e.type === 'priced');
	$: showNote = !$events.slice(0, position).some((e) => e.type === 'priced');
	$: showPriced = !$events.slice(position).some((e) => e.type === 'safe' || e.type === 'convertible');
</script>

<div
	bind:this={ref}
	on:mouseleave={() => (showMenu = false)}
	transition:box={{ scale: 20, duration: 200 }}
	class="rounded-full absolute z-20 left-[50%] top-[50%] h-11 w-11 max-sm:h-12 max-sm:w-12 -translate-x-[50%] -translate-y-[50%] bg-bg flex items-center justify-center"
>
	<svg
		width="28"
		height="28"
		class="group cursor-pointer active:scale-[0.97] max-sm:w-8 max-sm:h-8"
		viewBox="0 0 39 39"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		on:click={() => {
			showMenu = true;
		}}
	>
		<path
			d="M17.6921 25.5597V13H20.8675V25.5597H17.6921ZM13 20.8675V17.6921H25.5597V20.8675H13Z"
			class="fill-textLight"
		/>
		<path
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M19.5 39C8.73045 39 0 30.2696 0 19.5C0 8.73045 8.73045 0 19.5 0C30.2696 0 39 8.73045 39 19.5C39 30.2696 30.2696 39 19.5 39ZM19.5 2C9.83502 2 2 9.83502 2 19.5C2 29.165 9.83502 37 19.5 37C29.165 37 37 29.165 37 19.5C37 9.83502 29.165 2 19.5 2Z"
			class="fill-borderDark group-hover:fill-textLight"
		/>
	</svg>

	{#if showMenu}
		<div
			transition:menu
			class="absolute -left-8 top-[50%] -translate-y-[50%] p-12 pl-24 max-sm:p-0 max-sm:top-[50%] max-sm:-translate-x-[50%] max-sm:left-[50%]"
		>
			<div
				class="bg-white text-textDark rounded-xl text-[13px] z-[21] relative border border-white menu-box"
			>
				<div
					on:click={addSafe}
					class={cn(
						'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap rounded-t-xl',
						!showSafe && 'pointer-events-none'
					)}
				>
					<div class={cn('w-3 mr-3 text-primary', !showSafe && 'opacity-30')}>
						<SafeIcon />
					</div>
					<span class={cn(!showSafe && 'opacity-30')}
						>SAFE<span class="text-textLight ml-1">(Post-money)</span></span
					>
				</div>
				<div
					on:click={addConvertibleNote}
					class={cn(
						'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap',
						!showNote && 'pointer-events-none'
					)}
				>
					<div class={cn('w-3 mr-3 text-primary', !showNote && 'opacity-30')}>
						<NoteIcon />
					</div>
					<span class={cn(!showNote && 'opacity-30')}
						>Convertible Note<span class="text-textLight ml-1">/ Debt</span></span
					>
				</div>
				<div
					on:click={addPriced}
					class={cn(
						'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap',
						!showPriced && 'pointer-events-none'
					)}
				>
					<div class={cn('w-3 mr-3 text-primary', !showPriced && 'opacity-30')}>
						<PricedIcon />
					</div>

					<span class={cn(!showPriced && 'opacity-30')}
						>Priced Round<span class="text-textLight ml-1">/ Equity Financing</span></span
					>
				</div>
				<div
					on:click={() => addOptions()}
					class={cn(
						'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap'
					)}
				>
					<div class={cn('w-3 mr-3 text-primary')}><OptionsIcon /></div>

					<span>Employee Options</span>
				</div>

				<!-- Accelerator with submenu -->
				<div
					class="relative"
					on:mouseenter={() => (showAcceleratorSubmenu = true)}
					on:mouseleave={() => (showAcceleratorSubmenu = false)}
				>
					<div
						on:click={() => (showAcceleratorSubmenu = !showAcceleratorSubmenu)}
						class={cn(
							'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap',
							!showSafe && 'pointer-events-none'
						)}
					>
						<div class={cn('w-3 mr-3 text-primary', !showSafe && 'opacity-30')}>
							<AcceleratorIcon />
						</div>
						<span class={cn(!showSafe && 'opacity-30')}>Accelerator</span>
						<svg
							class={cn('w-3 h-3 ml-auto', !showSafe && 'opacity-30')}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</div>

					{#if showAcceleratorSubmenu && showSafe}
						<div
							class="absolute left-full top-0 ml-1 bg-white rounded-xl border border-white overflow-hidden z-[22] menu-box max-sm:left-0 max-sm:top-full max-sm:ml-0 max-sm:mt-1"
						>
							{#each ACCELERATOR_PRESETS as preset}
								<div
									on:click={() => addAccelerator(preset)}
									class="flex items-center justify-between h-[44px] px-4 cursor-pointer min-w-[180px] hover:bg-bg active:bg-borderLight whitespace-nowrap border-b border-borderLight last:border-none"
								>
									<span>{preset.name}</span>
									{#if preset.equityFree}
										<span class="text-textLight text-xs ml-2">0%</span>
									{:else}
										<span class="text-textLight text-xs ml-2">{preset.equity}%</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div
					on:click={() => {
						showMenu = false;
						$exit = {
							amount: 0,
							tax: 20
						};
					}}
					class={cn(
						'border-b border-borderLight last:border-none flex items-center h-[44px] px-4 cursor-pointer min-w-[150px] hover:bg-bg active:bg-borderLight whitespace-nowrap rounded-b-xl',
						!showExit && 'pointer-events-none'
					)}
				>
					<div class={cn('w-3 mr-3 text-primary', !showExit && 'opacity-30')}>
						<ExitIcon />
					</div>
					<span class={cn(!showExit && 'opacity-30')}
						>Exit<span class="text-textLight ml-1">/ Sell the venture</span></span
					>
				</div>
			</div>
		</div>
	{/if}
</div>
