<script lang="ts">
	import { cn, formatAmount } from '$lib';
	import Input from '$lib/common/Input.svelte';
	import { companyName, exit, events, finalYouShares, founders, tables } from '$lib/store';
	import { getTableTotalShares } from '$lib/calculations';
	import FloatingTable from './FloatingTable.svelte';
	import tippy from 'svelte-tippy';

	const exportToCSV = () => {
		const rows: string[] = [];
		const addRow = (...cols: (string | number)[]) => rows.push(cols.map(c => `"${c}"`).join(','));
		const addBlank = () => rows.push('');

		// Header
		addRow('Venture Finance Simulation Export');
		addRow('Generated', new Date().toLocaleDateString());
		addBlank();

		// Company Info
		addRow('COMPANY');
		addRow('Name', $companyName || 'Unnamed Venture');
		addBlank();

		// Founders
		addRow('FOUNDERS');
		addRow('Name', 'Initial Equity %');
		$founders.forEach(f => addRow(f.name, f.equity));
		addBlank();

		// Funding Events
		addRow('FUNDING EVENTS');
		$events.forEach((e, i) => {
			if (e.type === 'safe') {
				addRow(`Event ${i + 1}: SAFE`);
				addRow('Name', e.name);
				addRow('Amount', e.amount);
				addRow('Valuation Cap', e.valCap);
				addRow('Discount', `${e.discount}%`);
				addRow('Pro Rata', e.proRata ? 'Yes' : 'No');
				addRow('MFN', e.mfn ? 'Yes' : 'No');
			} else if (e.type === 'convertible') {
				addRow(`Event ${i + 1}: Convertible Note`);
				addRow('Name', e.name);
				addRow('Amount', e.amount);
				addRow('Valuation Cap', e.valCap);
				addRow('Discount', `${e.discount}%`);
				addRow('Interest Rate', `${e.interestRate}%`);
				addRow('Term (months)', e.term);
				addRow('Pro Rata', e.proRata ? 'Yes' : 'No');
			} else if (e.type === 'priced') {
				addRow(`Event ${i + 1}: Priced Round`);
				addRow('Name', e.name);
				addRow('Amount Raised', e.amount);
				addRow('Pre-Money Valuation', e.valuation);
				addRow('Options Pool', `${e.options}%`);
				addRow('Pro Rata', e.proRata ? 'Yes' : 'No');
			} else if (e.type === 'options') {
				addRow(`Event ${i + 1}: Employee Options`);
				addRow('Amount Granted', `${e.amount}%`);
				addRow('Recipient', e.grantName || 'N/A');
			}
			addBlank();
		});

		// Cap Table
		addRow('CAP TABLE AT EXIT');
		addRow('Shareholder', 'Shares', 'Equity %');
		const finalTable = $tables[$tables.length - 1];
		const totalShares = getTableTotalShares(finalTable);
		Object.entries(finalTable).forEach(([name, shares]) => {
			const equity = ((shares / totalShares) * 100).toFixed(2);
			addRow(name, shares, `${equity}%`);
		});
		addBlank();

		// Exit Summary
		addRow('EXIT SUMMARY');
		addRow('Exit Valuation', $exit?.amount || 0);
		addRow('Your Final Ownership', `${$finalYouShares.toFixed(2)}%`);
		addRow('Your Payout (pre-tax)', (($exit?.amount || 0) * $finalYouShares) / 100);

		// Download
		const csv = rows.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${$companyName || 'simulation'}-exit-simulation.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};
</script>

<div class="relative flex flex-col items-center group bg-bg">
	<div
		class="pt-10 pb-0 rounded-3xl border-[4px] border-borderLight overflow-hidden max-sm:w-[350px]"
	>
		<div class="px-16 flex flex-col items-center">
			<div class="text-2xl text-primary relative">LETS GOOOO 🔥</div>
			<div class="mt-8 mb-2 text-sm">Your venture got acquired for</div>
			<Input
				value={$exit?.amount}
				onchange={(val) => {
					$exit && ($exit.amount = parseFloat(val));
				}}
				width="220"
				white
			/>
			<div class=" mt-10 max-sm:text-center">
				You retained <span
					class="inline-block rounded-lg p-1 px-1.5 mx-1 border-[2px] border-borderDark [box-shadow:0px_1px_theme(colors.borderDark)]"
					>{parseFloat($finalYouShares.toFixed(1))}%</span
				> ownership at exit.
			</div>
		</div>
		<div class=" text-center border-t-[3px] border-borderLight text-2xl mt-10 bg-white p-6 flex-1">
			<div class="text-sm mb-2 text-textLight">
				After <span
					use:tippy={{ content: 'Investors with liquidation preferences get paid first before common shareholders (founders) receive proceeds.', placement: 'top' }}
					class="underline decoration-dotted cursor-help"
				>liquidation preferences</span>,
			</div>
			You get&nbsp;<span class="text-primary"
				>{formatAmount((($exit?.amount || 0) * $finalYouShares) / 100)}</span
			>
			<div class="text-sm mt-2 text-textLight">(pre-tax)</div>
		</div>
	</div>
	<div class="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 max-sm:!opacity-100">
		<button
			on:click={() => {
				$exit = null;
			}}
			class="p-2 px-3 rounded-lg hover:bg-borderLight active:bg-borderDark text-textLight text-sm"
		>
			← Back
		</button>
		<button
			on:click={() => {
				if (navigator.share) {
					navigator.share({
						title: 'My Exit Simulation',
						text: `I retained ${parseFloat($finalYouShares.toFixed(1))}% ownership and would get ${formatAmount((($exit?.amount || 0) * $finalYouShares) / 100)} (pre-tax) from a ${formatAmount($exit?.amount || 0)} exit!`,
						url: window.location.href
					});
				} else {
					navigator.clipboard.writeText(window.location.href);
					alert('Link copied to clipboard!');
				}
			}}
			class="p-2 px-3 rounded-lg hover:bg-borderLight active:bg-borderDark text-textLight text-sm"
		>
			Share 📤
		</button>
		<button
			on:click={exportToCSV}
			class="p-2 px-3 rounded-lg hover:bg-borderLight active:bg-borderDark text-textLight text-sm"
		>
			Export 📊
		</button>
	</div>

	<!-- Lead Generation CTA -->
	<div class="mt-8 text-center max-w-[320px] animate-fade-in-up animation-delay-300">
		<p class="text-sm text-textLight mb-3">
			Ready to make moves? 50+ founders and investors have partnered with VenCounsel to get deals done.
		</p>
		<a
			href="https://calendar.app.google/XJBCScx7BWz86vCL6"
			target="_blank"
			class="inline-block gradient-btn text-white text-sm font-medium py-2.5 px-5 rounded-lg"
		>
			Book a Complimentary Consultation →
		</a>
	</div>
	<div
		class={cn(
			'max-sm:static max-sm:mt-10 max-sm:translate-x-0 max-sm:translate-y-0 absolute -right-[20px] top-[50%] -translate-y-[50%] translate-x-[100%]'
		)}
	>
		<FloatingTable position={$tables.length - 2} valuation={$exit?.amount} />
	</div>
</div>
