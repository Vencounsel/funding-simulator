<script lang="ts">
	import PlusButton from './PlusButton.svelte';

	export let height: string = '70px';
	export let noButton: boolean = false;
	let showPlusButton = false;

	export let position: number;
</script>

<div
	class="flex justify-center items-center relative w-10"
	style:height
	on:mouseenter={() => (showPlusButton = true)}
	on:mouseleave={() => (showPlusButton = false)}
>
	<div class="w-[3px] h-full bg-[url(/stripe.svg)] max-sm:!h-[80px]" />
	{#if !noButton && showPlusButton}
		<div class="max-sm:hidden">
			<PlusButton {position} />
		</div>
	{/if}

	{#if !noButton}
		<div class="hidden max-sm:block">
			<PlusButton {position} />
		</div>
	{/if}
</div>
