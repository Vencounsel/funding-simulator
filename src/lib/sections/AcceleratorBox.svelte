<script lang="ts">
	import { cn, formatAmount } from '$lib';
	import DeleteIcon from '$lib/icons/DeleteIcon.svelte';
	import Input from '$lib/common/Input.svelte';
	import { events } from '$lib/store';
	import type { Accelerator } from '$lib/types';
	import { onMount } from 'svelte';

	export let data: Accelerator;
	export let index: number;

	let showEdit = false;
	let ref: HTMLDivElement;

	onMount(() => {
		const handleClick = (e: MouseEvent) => {
			if (ref && !ref?.contains(e.target as Node)) {
				showEdit = false;
			}
		};

		document.addEventListener('click', handleClick, true);
		return () => document.removeEventListener('click', handleClick, true);
	});

	const deleteEvent = () => {
		$events = $events.filter((_, i) => i !== index);
	};
</script>

<div bind:this={ref} class="relative h-[70px] max-sm:h-[105px] group px-11 __event max-sm:px-0">
	{#if showEdit}
		<!-- Backdrop overlay -->
		<div class="fixed inset-0 bg-black/20 z-20" />
		<div
			class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-fit h-fit border border-white rounded-2xl bg-white shadow-lg z-[21] max-sm:fixed max-sm:inset-0 max-sm:m-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-[350px]"
		>
			<div class="bg-bg flex justify-between items-center h-[54px] px-8 gap-4 rounded-t-2xl">
				<span class="text-primary text-lg">{data.programName}</span>
				<div class="text-textLight text-sm">Accelerator (Equity-Free)</div>
			</div>
			<div class="bg-white border-y-[3px] border-borderLight p-8 py-6">
				<div class="flex gap-5 justify-center max-sm:flex-col max-sm:items-center">
					<div>
						<div class="text-center mb-3">Funding Amount</div>
						<Input
							value={data.amount}
							onchange={(value) => {
								data.amount = parseInt(value);
							}}
							width="187"
						/>
					</div>
				</div>
			</div>
			<div class="bg-bg flex align-center justify-center py-5 rounded-b-2xl text-textLight text-sm">
				No equity taken - Grant / Prize Money
			</div>
		</div>
	{:else}
		<div
			on:click={() => (showEdit = true)}
			class="bg-bg text-sm cursor-pointer hover:border-borderDark border-2 border-borderLight flex items-center gap-3 py-2 px-4 rounded-xl mx-auto w-fit max-sm:w-[350px] max-sm:justify-center max-sm:flex-col"
		>
			<div class="flex items-center gap-2">
				<span class="text-textLight">Accelerator</span>
				<span class="text-primary font-medium">{data.programName}</span>
			</div>
			<div class="flex items-center gap-3 text-textLight text-xs">
				<span>Funding: <span class="text-textDark">{data.amount ? formatAmount(data.amount) : '-'}</span></span>
				<span>Equity: <span class="text-textDark">0%</span></span>
			</div>
		</div>
	{/if}
	<button
		class="max-sm:opacity-70 block right-[0] text-textLight top-[0px] hover:bg-borderLight group-hover:opacity-100 opacity-0 active:bg-borderDark rounded-lg p-2.5 absolute max-sm:right-[50%] max-sm:translate-x-[50%] max-sm:top-[72px] max-sm:scale-90"
		on:click={deleteEvent}
	>
		<DeleteIcon />
	</button>
</div>
