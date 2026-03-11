<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let search = $state('');
	let editingId: number | null = $state(null);
	let showCreate = $state(false);
	let filterAreaId: number | null = $state(null);

	const areaMap = $derived(
		Object.fromEntries(data.areas.map((a: any) => [a.id, a.nombre]))
	);

	let filteredProducts = $derived(
		data.products
			.filter((p: any) => p.nombre.toLowerCase().includes(search.toLowerCase()))
			.filter((p: any) => filterAreaId === null || p.areaId === filterAreaId)
	);
</script>

<div class="p-6 max-w-5xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-gray-800">Inventario</h1>
		<button
			onclick={() => showCreate = !showCreate}
			class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
		>
			{showCreate ? 'Cancelar' : '+ Nuevo Producto'}
		</button>
	</div>

	{#if showCreate}
		<form method="POST" action="?/create" use:enhance class="bg-white p-4 rounded-lg shadow mb-6 flex gap-3 items-end flex-wrap">
			<div class="flex-1 min-w-[140px]">
				<label for="nombre" class="block text-xs text-gray-500 mb-1">Nombre</label>
				<input type="text" name="nombre" id="nombre" required class="w-full px-3 py-2 border rounded-md text-sm" />
			</div>
			<div class="w-32">
				<label for="precio" class="block text-xs text-gray-500 mb-1">Precio</label>
				<input type="number" name="precio" id="precio" step="0.01" min="0" required class="w-full px-3 py-2 border rounded-md text-sm" />
			</div>
			<div class="w-24">
				<label for="stock" class="block text-xs text-gray-500 mb-1">Stock</label>
				<input type="number" name="stock" id="stock" min="0" required class="w-full px-3 py-2 border rounded-md text-sm" />
			</div>
			<div class="w-36">
				<label for="areaId" class="block text-xs text-gray-500 mb-1">Área</label>
				<select name="areaId" id="areaId" class="w-full px-3 py-2 border rounded-md text-sm">
					<option value="">Sin área</option>
					{#each data.areas as area}
						<option value={area.id}>{area.nombre}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm transition-colors">Guardar</button>
		</form>
	{/if}

	<div class="flex gap-3 mb-4 items-center">
		<input
			type="text"
			bind:value={search}
			placeholder="Buscar producto..."
			class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
		/>
		<div class="flex gap-1">
			<button onclick={() => filterAreaId = null} class="px-3 py-2 text-xs rounded-lg transition-colors {filterAreaId === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'}">Todas</button>
			{#each data.areas as area}
				<button onclick={() => filterAreaId = area.id} class="px-3 py-2 text-xs rounded-lg transition-colors {filterAreaId === area.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'}">{area.nombre}</button>
			{/each}
		</div>
	</div>

	<!-- Top Products Stats -->
	{#if data.topProducts && data.topProducts.length > 0}
		<div class="bg-white rounded-lg shadow mb-6 p-4">
			<h2 class="text-sm font-semibold text-gray-600 mb-3">📊 Productos Más Vendidos</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each data.topProducts as tp, i}
					<div class="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
						<span class="text-lg font-bold text-gray-300 w-6 text-right">#{i + 1}</span>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm truncate">{tp.nombre}</div>
							<div class="text-xs text-gray-500">{tp.totalVendido} unidades &middot; {'$'}{tp.ingresos}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="bg-white rounded-lg shadow overflow-hidden">
		<table class="w-full text-sm">
			<thead class="bg-gray-50 text-gray-600">
				<tr>
					<th class="text-left px-4 py-3">Nombre</th>
					<th class="text-left px-4 py-3">Área</th>
					<th class="text-right px-4 py-3">Precio</th>
					<th class="text-right px-4 py-3">Stock</th>
					<th class="text-center px-4 py-3">Estado</th>
					<th class="text-right px-4 py-3">Acciones</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredProducts as product}
					{#if editingId === product.id}
						<tr class="border-t bg-blue-50">
							<td class="px-4 py-2"><input type="text" name="nombre" form="edit-{product.id}" value={product.nombre} class="w-full px-2 py-1 border rounded text-sm" /></td>
							<td class="px-4 py-2">
								<select name="areaId" form="edit-{product.id}" class="px-2 py-1 border rounded text-sm">
									<option value="" selected={!product.areaId}>Sin área</option>
									{#each data.areas as area}
										<option value={area.id} selected={product.areaId === area.id}>{area.nombre}</option>
									{/each}
								</select>
							</td>
							<td class="px-4 py-2"><input type="number" name="precio" form="edit-{product.id}" value={product.precio} step="0.01" class="w-full px-2 py-1 border rounded text-sm text-right" /></td>
							<td class="px-4 py-2"><input type="number" name="stock" form="edit-{product.id}" value={product.stock} class="w-full px-2 py-1 border rounded text-sm text-right" /></td>
							<td class="px-4 py-2 text-center">
								<select name="activo" form="edit-{product.id}" class="px-2 py-1 border rounded text-sm">
									<option value="true" selected={product.activo}>Activo</option>
									<option value="false" selected={!product.activo}>Inactivo</option>
								</select>
							</td>
							<td class="px-4 py-2 text-right">
								<form id="edit-{product.id}" method="POST" action="?/update" use:enhance={() => {
									return async ({ update }) => {
										await update();
										editingId = null;
									};
								}}>
									<input type="hidden" name="id" value={product.id} />
									<button type="submit" class="text-green-600 hover:text-green-800 mr-2">Guardar</button>
								</form>
								<button type="button" onclick={() => editingId = null} class="text-gray-500 hover:text-gray-700">Cancelar</button>
							</td>
						</tr>
					{:else}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-3">{product.nombre}</td>
							<td class="px-4 py-3 text-gray-500 text-xs">{product.areaId ? areaMap[product.areaId] ?? '—' : '—'}</td>
							<td class="px-4 py-3 text-right">${product.precio}</td>
							<td class="px-4 py-3 text-right">{product.stock}</td>
							<td class="px-4 py-3 text-center">
								<span class="text-xs px-2 py-0.5 rounded {product.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
									{product.activo ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<button onclick={() => editingId = product.id} class="text-blue-600 hover:text-blue-800 text-sm mr-2">Editar</button>
								<form method="POST" action="?/delete" use:enhance class="inline">
									<input type="hidden" name="id" value={product.id} />
									<button type="submit" class="text-red-500 hover:text-red-700 text-sm">Eliminar</button>
								</form>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
