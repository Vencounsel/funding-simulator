<script lang="ts">
	import { goto } from '$app/navigation';
	import { box_reverse } from '$lib';
	import Dash from '$lib/common/Dash.svelte';
	import PlusButton from '$lib/common/PlusButton.svelte';
		import Exit from '$lib/sections/Exit.svelte';
	import Founders from '$lib/sections/Founders.svelte';
	import FundingBox from '$lib/sections/FundingBox.svelte';
	import Homepage from '$lib/sections/Homepage.svelte';
	import Options from '$lib/sections/Options.svelte';
	import AcceleratorBox from '$lib/sections/AcceleratorBox.svelte';
	import Results from '$lib/sections/Results.svelte';
	import { events, exit, loadedData } from '$lib/store';
	import MoonIcon from '$lib/icons/MoonIcon.svelte';
	import SunIcon from '$lib/icons/SunIcon.svelte';
	import GithubIcon from '$lib/icons/GithubIcon.svelte';
	import LinkedInIcon from '$lib/icons/LinkedInIcon.svelte';
	import ArrowLeftIcon from '$lib/icons/ArrowLeftIcon.svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import EarthIcon from '$lib/icons/EarthIcon.svelte';
	import tippy from 'svelte-tippy';

	let theme: 'light' | 'dark' = 'light';

	onMount(() => {
		if (localStorage.getItem('theme')) {
			if (localStorage.getItem('theme') == 'dark') {
				theme = 'dark';
				document.documentElement.setAttribute('data-theme', 'dark');
			}
		}
	});

	// Determine dash height based on transition between funding stages
	const getDashHeight = (eventIndex: number): string => {
		const prevEvent = $events[eventIndex - 1];
		const nextEvent = $events[eventIndex];

		// 140px after any priced round (including before exit)
		if (prevEvent?.type === 'priced') {
			return '140px';
		}

		if (!nextEvent) return '90px';

		// 140px before any priced round
		if (nextEvent.type === 'priced') {
			return '140px';
		}

		// 90px between SAFEs and/or Convertible Notes
		return '90px';
	};
</script>

{#if $loadedData}
	<!-- Back button - visible on all screens -->
	<div transition:fade class="__invertable fixed top-[20px] left-[20px] max-sm:top-[15px] max-sm:left-[15px] z-[3]">
		<button
			on:click={() => {
				goto('/', { replaceState: true });
				$loadedData = false;
			}}
			class="text-textLight w-10 h-10 rounded-xl hover:bg-borderLight active:bg-borderDark flex items-center justify-center hover:scale-110 transition-transform glass"
		>
			<ArrowLeftIcon />
		</button>
	</div>

	<!-- Progress Ring - desktop only -->
	<div transition:fade class="__invertable max-sm:hidden fixed top-[80px] left-[30px] z-[3]">
		{#if true}
			{@const currentStep = $exit ? 3 : $events.length > 0 ? 2 : 1}
			{@const progress = (currentStep / 3) * 100}
			<div class="relative w-8 h-8">
				<svg class="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
					<circle
						cx="16"
						cy="16"
						r="12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="text-borderLight"
					/>
					<circle
						cx="16"
						cy="16"
						r="12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						class="text-primary transition-all duration-300"
						stroke-dasharray="75.4"
						stroke-dashoffset={75.4 - (75.4 * progress) / 100}
					/>
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-[10px] text-textLight">{currentStep}/3</span>
			</div>
		{/if}
	</div>
{/if}

<div id="content">
	{#if $loadedData}
		<div
			class="will-change-transform origin-top flex flex-col items-center relative z-[2]"
			in:box_reverse={{ delay: 100, duration: 300, scale: 25 }}
			out:box_reverse={{ duration: 300, scale: 25 }}
		>
			<Founders />

			<Dash position={0} noButton={$events.length === 0} height={getDashHeight(0)} />
			{#each $events as event, eId}
				{#if event.type === 'safe' || event.type === 'priced' || event.type === 'convertible'}
					<FundingBox index={eId} bind:data={event} />
				{/if}
				{#if event.type === 'options'}
					<Options index={eId} bind:data={event} />
				{/if}
				{#if event.type === 'accelerator'}
					<AcceleratorBox index={eId} bind:data={event} />
				{/if}
				<Dash position={eId + 1} noButton={!$exit && eId === $events.length - 1} height={getDashHeight(eId + 1)} />
			{/each}

			{#if $exit}
				{#if $exit?.amount}
					<Results />
				{:else}
					<Exit />
				{/if}
			{:else}
				<div class="flex flex-col items-center">
					{#if $events.length === 0}
						<div class="text-center mb-12 animate-fade-in-up">
							<div class="text-xs uppercase tracking-widest text-textLight opacity-50 mb-1">Next step</div>
							<div class="text-sm text-textLight">Add your first funding round</div>
						</div>
					{/if}
					<div class="relative h-12 w-12">
						<PlusButton position={$events.length} />
					</div>
				</div>
			{/if}
			<div class="h-60" />
		</div>
	{:else}
		<Homepage />
	{/if}
</div>

<div
	class="__invertable fixed bottom-[30px] left-[30px] text-textLight z-[3] flex flex-col gap-1 items-center glass p-2 max-sm:flex-row max-sm:fixed max-sm:bottom-[20px] max-sm:left-[50%] max-sm:-translate-x-[50%] max-sm:gap-2 max-sm:rounded-full max-sm:px-4 max-sm:py-2"
>
	<button
		transition:fade
		on:click={() => {
			const newTheme = theme === 'dark' ? 'light' : 'dark';
			localStorage.setItem('theme', newTheme);
			theme = newTheme;
			document.documentElement.setAttribute('data-theme', newTheme);
		}}
		class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-borderLight active:bg-borderDark hover:scale-110 transition-transform"
	>
		{#if theme === 'dark'}
			<MoonIcon />
		{:else}
			<SunIcon />
		{/if}
	</button>
	<a
		href="https://github.com/Vencounsel/venture-sim"
		target="_blank"
		class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-borderLight active:bg-borderDark hover:scale-110 transition-transform"
	>
		<GithubIcon />
	</a>
	<a
		href="https://linkedin.com/company/vencounsel"
		target="_blank"
		class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-borderLight active:bg-borderDark hover:scale-110 transition-transform"
	>
		<LinkedInIcon />
	</a>
	<a
		href="https://vencounsel.com"
		target="_blank"
		class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-borderLight active:bg-borderDark hover:scale-110 transition-transform"
	>
		<EarthIcon />
	</a>
</div>

<!-- Desktop footer -->
<div class="__invertable fixed bottom-[30px] right-[30px] text-[11px] text-textLight z-[3] max-sm:hidden text-right">
	Built on vibes ✨ by <a href="https://vencounsel.com" target="_blank" class="hover:text-primary transition-colors">VenCounsel</a>
	<div class="mt-1 opacity-60">⚠️ For fun only. Not legal, financial, tax or relationship advice. May contain errors.</div>
</div>

<!-- Mobile footer -->
<div class="__invertable hidden max-sm:block fixed bottom-[70px] left-[50%] -translate-x-[50%] z-[2] text-center text-[9px] text-textLight opacity-60 w-[300px]">
	⚠️ Not legal, financial, tax or relationship advice. May contain errors.
</div>
