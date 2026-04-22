<script lang="ts">
	import { ripple } from '$lib/attachments/ripple'
	import Icon, { type IconType } from '$lib/components/icon/Icon.svelte'

	interface Links {
		icon: IconType
		title: string
		href: string
	}

	const links: Links[] = [
		{
			title: m.aboutSourceCode(),
			href: 'https://github.com/Cat-Ling/serafin-pwa',
			icon: 'github',
		},
		{
			title: m.aboutPrivacy(),
			href: 'https://github.com/Cat-Ling/serafin-pwa#privacy',
			icon: 'lockCheck',
		},
		{
			title: m.aboutHomepage(),
			href: '/',
			icon: 'home',
		},
	]
</script>

<section class="m-auto flex w-full flex-col select-text sm:max-w-lg">
	<div class="mb-10 flex flex-col items-center gap-4 text-center text-headline-md">
		<img src="/icons/responsive.svg" class="size-16" alt="Logo" />
		{m.appName()}
	</div>

	<ul class="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
		{#each links as link}
			<li>
				<a
					{@attach ripple()}
					href={link.href}
					class="relative flex w-full items-center gap-4 overflow-clip rounded-lg border border-primary/10 bg-surfaceContainerLowest p-4 transition-transform hover:-translate-y-1"
					target="_blank"
					rel="noopener"
				>
					<Icon type={link.icon} class="size-5" />
					{link.title}
					<Icon type="openInNew" class="ml-auto size-4 text-onSurfaceVariant" />
				</a>
			</li>
		{/each}
	</ul>

	<div class="mt-12 flex flex-col gap-4 px-4 text-center">
		<div class="text-title-sm text-onSurfaceVariant uppercase tracking-widest">{m.aboutCredits()}</div>
		<div class="flex flex-col gap-1">
			<div class="text-body-md">{m.aboutBasedOn({ name: 'Snae Player' })}</div>
			<div class="text-body-sm text-onSurfaceVariant">
				{m.aboutOriginalCreator()}: 
				<a href="https://github.com/minht11" class="text-primary hover:underline" target="_blank" rel="noopener">minht11</a>
			</div>
			<a href="https://github.com/minht11/local-music-pwa" class="text-body-sm text-primary hover:underline" target="_blank" rel="noopener">
				Original Repository
			</a>
		</div>
	</div>
</section>
