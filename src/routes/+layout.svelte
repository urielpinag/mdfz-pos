<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { LayoutData } from './$types.js';

	let { data, children }: { data: LayoutData; children: any } = $props();

	function navItems(role: string) {
		const items: { href: string; label: string; icon: string }[] = [];
		if (role === 'supervisor' || role === 'vendedor') {
			items.push({ href: '/vender', label: 'Vender', icon: '🛒' });
		}
		if (role === 'admin' || role === 'supervisor') {
			items.push({ href: '/inventario', label: 'Inventario', icon: '📦' });
		}
		if (role === 'admin' || role === 'supervisor') {
			items.push({ href: '/admin/dashboard', label: 'Administración', icon: '⚙️' });
		}
		return items;
	}

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}
</script>

{#if data.user}
	<div class="flex h-screen">
		<!-- Sidebar -->
		<aside class="w-56 bg-gray-900 text-white flex flex-col shrink-0">
			<div class="px-4 py-5 border-b border-gray-700">
				<span class="font-bold text-xl">POS MDFZ</span>
			</div>

			<nav class="flex-1 py-4">
				{#each navItems(data.user.role) as item}
					<a
						href={item.href}
						class="flex items-center gap-3 px-4 py-3 text-sm transition-colors {isActive(item.href) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
					>
						<span>{item.icon}</span>
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>

			<div class="border-t border-gray-700 p-4">
				<div class="text-sm text-gray-400 mb-2">
					<div class="font-medium text-white">{data.user.username}</div>
					<span class="text-xs bg-gray-700 px-2 py-0.5 rounded">{data.user.role}</span>
				</div>
				<form method="POST" action="/api/auth/logout">
					<button type="submit" class="w-full text-sm bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded transition-colors">
						Cerrar Sesión
					</button>
				</form>
			</div>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 overflow-auto bg-gray-50">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
