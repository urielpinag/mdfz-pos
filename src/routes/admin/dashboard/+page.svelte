<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isAdmin = $derived(data.role === 'admin');
	let showCreateUser = $state(false);
	let showCreateArea = $state(false);
	let editingUserId: number | null = $state(null);
	let editingAreaId: number | null = $state(null);
	let editingShiftId: number | null = $state(null);
	let editingOrderId: number | null = $state(null);
	let activeTab: 'users' | 'shifts' | 'orders' | 'areas' = $state('users');
	let expandedShiftId: number | null = $state(null);
	let expandedOrderId: number | null = $state(null);

	// Filter state
	let filterFrom = $state(data.filters.from ?? '');
	let filterTo = $state(data.filters.to ?? '');
	let filterUser = $state(data.filters.user ?? '');
	let filterMetodo = $state(data.filters.metodo ?? '');

	function applyFilters() {
		const params = new URLSearchParams();
		if (filterFrom) params.set('from', filterFrom);
		if (filterTo) params.set('to', filterTo);
		if (filterUser) params.set('user', filterUser);
		if (filterMetodo) params.set('metodo', filterMetodo);
		goto(`/admin/dashboard?${params.toString()}`, { invalidateAll: true });
	}

	function clearFilters() {
		filterFrom = '';
		filterTo = '';
		filterUser = '';
		filterMetodo = '';
		goto('/admin/dashboard', { invalidateAll: true });
	}

	function downloadCSV() {
		const headers = ['ID', 'Fecha', 'Usuario', 'Método de Pago', 'Total', 'Productos'];
		const rows = data.orders.map((o: any) => {
			const items = data.orderItems
				.filter((i: any) => i.orderId === o.id)
				.map((i: any) => `${i.cantidad}x ${i.productName}`)
				.join('; ');
			return [
				o.id,
				new Date(o.createdAt).toLocaleString('es-MX'),
				data.userMap[o.userId] ?? 'Desconocido',
				o.metodoPago,
				o.total,
				`"${items}"`
			].join(',');
		});
		const csv = [headers.join(','), ...rows].join('\n');
		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ordenes_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function userName(id: number): string {
		return data.userMap[id] ?? 'Desconocido';
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold text-gray-800">Administración</h1>
		{#if !isAdmin}
			<span class="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded">Solo lectura</span>
		{/if}
	</div>

	<!-- Tabs -->
	<div class="flex gap-2 mb-6 border-b border-gray-200 pb-2">
		{#each [{ key: 'users', label: 'Usuarios' }, { key: 'shifts', label: 'Turnos / Cortes' }, { key: 'orders', label: 'Registros' }, { key: 'areas', label: 'Áreas' }] as tab}
			<button
				onclick={() => activeTab = tab.key as any}
				class="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors {activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if form?.error}
		<div class="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="bg-green-100 text-green-700 px-4 py-2 rounded mb-4 text-sm">Operación exitosa</div>
	{/if}
	{#if form?.resetSuccess}
		<div class="bg-yellow-100 text-yellow-700 px-4 py-2 rounded mb-4 text-sm">PIN reseteado a 0000</div>
	{/if}

	<!-- ==================== USUARIOS ==================== -->
	{#if activeTab === 'users'}
		{#if isAdmin}
			<div class="flex justify-end mb-4">
				<button
					onclick={() => showCreateUser = !showCreateUser}
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
				>
					{showCreateUser ? 'Cancelar' : '+ Nuevo Usuario'}
				</button>
			</div>

			{#if showCreateUser}
				<form method="POST" action="?/createUser" use:enhance class="bg-white p-4 rounded-lg shadow mb-4 flex gap-3 items-end flex-wrap">
					<div class="flex-1 min-w-[140px]">
						<label for="new-username" class="block text-xs text-gray-500 mb-1">Usuario</label>
						<input type="text" name="username" id="new-username" required class="w-full px-3 py-2 border rounded-md text-sm" />
					</div>
					<div class="w-32">
						<label for="new-pin" class="block text-xs text-gray-500 mb-1">PIN (4 dígitos)</label>
						<input type="text" name="pin" id="new-pin" maxlength="4" required inputmode="numeric" class="w-full px-3 py-2 border rounded-md text-sm" />
					</div>
					<div class="w-36">
						<label for="new-role" class="block text-xs text-gray-500 mb-1">Rol</label>
						<select name="role" id="new-role" class="w-full px-3 py-2 border rounded-md text-sm">
							<option value="vendedor">Vendedor</option>
							<option value="supervisor">Supervisor</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm">Crear</button>
				</form>
			{/if}
		{/if}

		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-gray-600">
					<tr>
						<th class="text-left px-4 py-3">Usuario</th>
						<th class="text-center px-4 py-3">Rol</th>
						<th class="text-left px-4 py-3">Creado</th>
						{#if isAdmin}<th class="text-right px-4 py-3">Acciones</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.users as user}
						{#if isAdmin && editingUserId === user.id}
							<tr class="border-t bg-blue-50">
								<td class="px-4 py-2"><input type="text" name="username" form="edit-user-{user.id}" value={user.username} class="w-full px-2 py-1 border rounded text-sm" /></td>
								<td class="px-4 py-2 text-center">
									<select name="role" form="edit-user-{user.id}" class="px-2 py-1 border rounded text-sm">
										<option value="vendedor" selected={user.role === 'vendedor'}>Vendedor</option>
										<option value="supervisor" selected={user.role === 'supervisor'}>Supervisor</option>
										<option value="admin" selected={user.role === 'admin'}>Admin</option>
									</select>
								</td>
								<td class="px-4 py-2">
									<input type="text" name="pin" form="edit-user-{user.id}" placeholder="Nuevo PIN" maxlength="4" class="w-full px-2 py-1 border rounded text-sm" />
								</td>
								<td class="px-4 py-2 text-right">
									<form id="edit-user-{user.id}" method="POST" action="?/updateUser" use:enhance={() => {
										return async ({ update }) => {
											await update();
											editingUserId = null;
										};
									}}>
										<input type="hidden" name="id" value={user.id} />
										<button type="submit" class="text-green-600 hover:text-green-800 mr-2">Guardar</button>
									</form>
									<button type="button" onclick={() => editingUserId = null} class="text-gray-500 hover:text-gray-700">Cancelar</button>
								</td>
							</tr>
						{:else}
							<tr class="border-t hover:bg-gray-50">
								<td class="px-4 py-3 font-medium">{user.username}</td>
								<td class="px-4 py-3 text-center">
									<span class="text-xs px-2 py-0.5 rounded {user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
										{user.role}
									</span>
								</td>
								<td class="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td>
								{#if isAdmin}
									<td class="px-4 py-3 text-right">
										<button onclick={() => editingUserId = user.id} class="text-blue-600 hover:text-blue-800 text-sm mr-2">Editar</button>
										<form method="POST" action="?/resetPin" use:enhance class="inline">
											<input type="hidden" name="id" value={user.id} />
											<button type="submit" class="text-yellow-600 hover:text-yellow-800 text-sm">Reset PIN</button>
										</form>
									</td>
								{/if}
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

	<!-- ==================== TURNOS / CORTES ==================== -->
	{:else if activeTab === 'shifts'}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-gray-600">
					<tr>
						<th class="text-left px-4 py-3">ID</th>
						<th class="text-left px-4 py-3">Usuario</th>
						<th class="text-left px-4 py-3">Apertura</th>
						<th class="text-left px-4 py-3">Cierre</th>
						<th class="text-center px-4 py-3">Estado</th>
						<th class="text-right px-4 py-3">{isAdmin ? 'Acciones' : 'Detalle'}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.shifts as shift}
						<tr class="border-t hover:bg-gray-50 cursor-pointer" onclick={() => expandedShiftId = expandedShiftId === shift.id ? null : shift.id}>
							<td class="px-4 py-3">#{shift.id}</td>
							<td class="px-4 py-3 font-medium">{userName(shift.userId)}</td>
							<td class="px-4 py-3">{new Date(shift.apertura).toLocaleString('es-MX')}</td>
							<td class="px-4 py-3">{shift.cierre ? new Date(shift.cierre).toLocaleString('es-MX') : '-'}</td>
							<td class="px-4 py-3 text-center">
								<span class="text-xs px-2 py-0.5 rounded {shift.cierre ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}">
									{shift.cierre ? 'Cerrado' : 'Abierto'}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								{#if isAdmin}
									<button onclick={(e) => { e.stopPropagation(); editingShiftId = editingShiftId === shift.id ? null : shift.id; }} class="text-blue-600 hover:text-blue-800 text-xs mr-1">Editar</button>
									<form method="POST" action="?/deleteShift" use:enhance class="inline" onsubmit={(e) => e.stopPropagation()}>
										<input type="hidden" name="id" value={shift.id} />
										<button type="submit" class="text-red-500 hover:text-red-700 text-xs" onclick={(e) => { if (!confirm('¿Eliminar turno y sus órdenes?')) e.preventDefault(); }}>Eliminar</button>
									</form>
								{/if}
								<span class="text-blue-600 text-xs ml-1">{expandedShiftId === shift.id ? '▲' : '▼'}</span>
							</td>
						</tr>
						{#if editingShiftId === shift.id && isAdmin}
							<tr class="bg-yellow-50 border-t" onclick={(e) => e.stopPropagation()}>
								<td colspan="6" class="px-6 py-3">
									<form method="POST" action="?/updateShift" use:enhance={() => {
										return async ({ update }) => { await update(); editingShiftId = null; };
									}} class="flex gap-3 items-end flex-wrap">
										<input type="hidden" name="id" value={shift.id} />
										<div>
											<label class="block text-xs text-gray-500 mb-1">Efectivo</label>
											<input type="number" name="montoEsperado" value={shift.montoEsperado} step="0.01" class="px-2 py-1 border rounded text-sm w-28" />
										</div>
										<div>
											<label class="block text-xs text-gray-500 mb-1">Tarjeta</label>
											<input type="number" name="montoTarjeta" value={shift.montoTarjeta} step="0.01" class="px-2 py-1 border rounded text-sm w-28" />
										</div>
										<div>
											<label class="block text-xs text-gray-500 mb-1">Transferencia</label>
											<input type="number" name="montoTransferencia" value={shift.montoTransferencia} step="0.01" class="px-2 py-1 border rounded text-sm w-28" />
										</div>
										<div>
											<label class="block text-xs text-gray-500 mb-1">Efectivo Real</label>
											<input type="number" name="montoReal" value={shift.montoReal ?? ''} step="0.01" class="px-2 py-1 border rounded text-sm w-28" />
										</div>
										<button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Guardar</button>
										<button type="button" onclick={() => editingShiftId = null} class="text-gray-500 hover:text-gray-700 text-sm">Cancelar</button>
									</form>
								</td>
							</tr>
						{/if}
						{#if expandedShiftId === shift.id}
							<tr class="bg-gray-50">
								<td colspan="6" class="px-6 py-4">
									<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
										<div class="bg-white p-3 rounded-lg border">
											<div class="text-xs text-gray-500">💵 Efectivo</div>
											<div class="text-lg font-bold text-green-600">{'$'}{shift.montoEsperado}</div>
										</div>
										<div class="bg-white p-3 rounded-lg border">
											<div class="text-xs text-gray-500">💳 Tarjeta</div>
											<div class="text-lg font-bold text-blue-600">{'$'}{shift.montoTarjeta}</div>
										</div>
										<div class="bg-white p-3 rounded-lg border">
											<div class="text-xs text-gray-500">🏦 Transferencia</div>
											<div class="text-lg font-bold text-purple-600">{'$'}{shift.montoTransferencia}</div>
										</div>
										<div class="bg-white p-3 rounded-lg border">
											<div class="text-xs text-gray-500">💰 Efectivo Real</div>
											<div class="text-lg font-bold {shift.montoReal ? 'text-gray-800' : 'text-gray-400'}">{shift.montoReal ? `$${shift.montoReal}` : 'Pendiente'}</div>
										</div>
									</div>
									{#if shift.montoReal}
										{@const diff = parseFloat(shift.montoReal) - parseFloat(shift.montoEsperado)}
										<div class="mt-3 flex items-center gap-4 text-sm">
											<span>Diferencia efectivo:</span>
											<span class="font-bold {diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-600'}">
												{'$'}{diff.toFixed(2)}
											</span>
											{#if shift.supervisorId}
												<span class="text-gray-400">| Cerrado por: <span class="font-medium text-gray-700">{userName(shift.supervisorId)}</span></span>
											{/if}
										</div>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

	<!-- ==================== REGISTROS / ÓRDENES ==================== -->
	{:else if activeTab === 'orders'}
		<!-- Filters -->
		<div class="bg-white p-4 rounded-lg shadow mb-4 flex gap-3 items-end flex-wrap">
			<div>
				<label for="filter-from" class="block text-xs text-gray-500 mb-1">Desde</label>
				<input type="date" id="filter-from" bind:value={filterFrom} class="px-3 py-2 border rounded-md text-sm" />
			</div>
			<div>
				<label for="filter-to" class="block text-xs text-gray-500 mb-1">Hasta</label>
				<input type="date" id="filter-to" bind:value={filterTo} class="px-3 py-2 border rounded-md text-sm" />
			</div>
			<div>
				<label for="filter-user" class="block text-xs text-gray-500 mb-1">Usuario</label>
				<select id="filter-user" bind:value={filterUser} class="px-3 py-2 border rounded-md text-sm">
					<option value="">Todos</option>
					{#each data.users as u}
						<option value={u.id.toString()}>{u.username}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="filter-metodo" class="block text-xs text-gray-500 mb-1">Método</label>
				<select id="filter-metodo" bind:value={filterMetodo} class="px-3 py-2 border rounded-md text-sm">
					<option value="">Todos</option>
					<option value="efectivo">Efectivo</option>
					<option value="tarjeta">Tarjeta</option>
					<option value="transferencia">Transferencia</option>
				</select>
			</div>
			<button onclick={applyFilters} class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">Filtrar</button>
			<button onclick={clearFilters} class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm">Limpiar</button>
			<button onclick={downloadCSV} class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm ml-auto">📥 Descargar CSV</button>
		</div>

		<!-- Summary -->
		<div class="flex gap-4 mb-4 text-sm">
			<div class="bg-white px-4 py-2 rounded-lg shadow">
				<span class="text-gray-500">Registros:</span> <span class="font-bold">{data.orders.length}</span>
			</div>
			<div class="bg-white px-4 py-2 rounded-lg shadow">
				<span class="text-gray-500">Total:</span>
				<span class="font-bold text-green-600">{'$'}{data.orders.reduce((s: number, o: any) => s + parseFloat(o.total), 0).toFixed(2)}</span>
			</div>
		</div>

		<!-- Orders table -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-gray-600">
					<tr>
						<th class="text-left px-4 py-3">#</th>
						<th class="text-left px-4 py-3">Fecha</th>
						<th class="text-left px-4 py-3">Usuario</th>
						<th class="text-center px-4 py-3">Método</th>
						<th class="text-right px-4 py-3">Total</th>
						<th class="text-right px-4 py-3">{isAdmin ? 'Acciones' : 'Detalle'}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order}
						<tr class="border-t hover:bg-gray-50 cursor-pointer" onclick={() => expandedOrderId = expandedOrderId === order.id ? null : order.id}>
							<td class="px-4 py-3">{order.id}</td>
							<td class="px-4 py-3">{new Date(order.createdAt).toLocaleString('es-MX')}</td>
							<td class="px-4 py-3">{userName(order.userId)}</td>
							<td class="px-4 py-3 text-center">
								<span class="text-xs px-2 py-0.5 rounded capitalize {order.metodoPago === 'efectivo' ? 'bg-green-100 text-green-700' : order.metodoPago === 'tarjeta' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
									{order.metodoPago}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-medium">{'$'}{order.total}</td>
							<td class="px-4 py-3 text-right">
								{#if isAdmin}
									<button onclick={(e) => { e.stopPropagation(); editingOrderId = editingOrderId === order.id ? null : order.id; }} class="text-blue-600 hover:text-blue-800 text-xs mr-1">Editar</button>
									<form method="POST" action="?/deleteOrder" use:enhance class="inline" onsubmit={(e) => e.stopPropagation()}>
										<input type="hidden" name="id" value={order.id} />
										<button type="submit" class="text-red-500 hover:text-red-700 text-xs" onclick={(e) => { if (!confirm('¿Eliminar este registro?')) e.preventDefault(); }}>Eliminar</button>
									</form>
								{/if}
								<span class="text-blue-600 text-xs ml-1">{expandedOrderId === order.id ? '▲' : '▼'}</span>
							</td>
						</tr>
						{#if editingOrderId === order.id && isAdmin}
							<tr class="bg-yellow-50 border-t" onclick={(e) => e.stopPropagation()}>
								<td colspan="6" class="px-6 py-3">
									<form method="POST" action="?/updateOrder" use:enhance={() => {
										return async ({ update }) => { await update(); editingOrderId = null; };
									}} class="flex gap-3 items-end">
										<input type="hidden" name="id" value={order.id} />
										<div>
											<label class="block text-xs text-gray-500 mb-1">Total</label>
											<input type="number" name="total" value={order.total} step="0.01" class="px-2 py-1 border rounded text-sm w-28" />
										</div>
										<div>
											<label class="block text-xs text-gray-500 mb-1">Método</label>
											<select name="metodoPago" class="px-2 py-1 border rounded text-sm">
												<option value="efectivo" selected={order.metodoPago === 'efectivo'}>Efectivo</option>
												<option value="tarjeta" selected={order.metodoPago === 'tarjeta'}>Tarjeta</option>
												<option value="transferencia" selected={order.metodoPago === 'transferencia'}>Transferencia</option>
											</select>
										</div>
										<button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Guardar</button>
										<button type="button" onclick={() => editingOrderId = null} class="text-gray-500 hover:text-gray-700 text-sm">Cancelar</button>
									</form>
								</td>
							</tr>
						{/if}
						{#if expandedOrderId === order.id}
							<tr class="bg-gray-50">
								<td colspan="6" class="px-6 py-3">
									<div class="text-xs text-gray-500 mb-2">Productos:</div>
									<div class="space-y-1">
										{#each data.orderItems.filter((i: any) => i.orderId === order.id) as item}
											<div class="flex justify-between text-sm">
												<span>{item.cantidad}x {item.productName}</span>
												<span class="text-gray-600">{'$'}{(item.cantidad * parseFloat(item.precioUnitario)).toFixed(2)}</span>
											</div>
										{/each}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
					{#if data.orders.length === 0}
						<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No hay registros con estos filtros</td></tr>
					{/if}
				</tbody>
			</table>
		</div>

	<!-- ==================== ÁREAS ==================== -->
	{:else}
		{#if isAdmin}
			<div class="flex justify-end mb-4">
				<button
					onclick={() => showCreateArea = !showCreateArea}
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
				>
					{showCreateArea ? 'Cancelar' : '+ Nueva Área'}
				</button>
			</div>

			{#if showCreateArea}
				<form method="POST" action="?/createArea" use:enhance class="bg-white p-4 rounded-lg shadow mb-4 flex gap-3 items-end">
					<div class="flex-1">
						<label for="area-nombre" class="block text-xs text-gray-500 mb-1">Nombre del Área</label>
						<input type="text" name="nombre" id="area-nombre" required class="w-full px-3 py-2 border rounded-md text-sm" />
					</div>
					<button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm">Crear</button>
				</form>
			{/if}
		{/if}

		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-gray-600">
					<tr>
						<th class="text-left px-4 py-3">ID</th>
						<th class="text-left px-4 py-3">Nombre</th>
						<th class="text-center px-4 py-3">Estado</th>
						<th class="text-center px-4 py-3">Productos</th>
						{#if isAdmin}<th class="text-right px-4 py-3">Acciones</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.areas as area}
						{#if isAdmin && editingAreaId === area.id}
							<tr class="border-t bg-blue-50">
								<td class="px-4 py-2">#{area.id}</td>
								<td class="px-4 py-2"><input type="text" name="nombre" form="edit-area-{area.id}" value={area.nombre} class="w-full px-2 py-1 border rounded text-sm" /></td>
								<td class="px-4 py-2 text-center">
									<select name="activo" form="edit-area-{area.id}" class="px-2 py-1 border rounded text-sm">
										<option value="true" selected={area.activo}>Activo</option>
										<option value="false" selected={!area.activo}>Inactivo</option>
									</select>
								</td>
								<td class="px-4 py-2 text-center text-gray-500">{data.areaProductCount[area.id] ?? 0}</td>
								<td class="px-4 py-2 text-right">
									<form id="edit-area-{area.id}" method="POST" action="?/updateArea" use:enhance={() => {
										return async ({ update }) => { await update(); editingAreaId = null; };
									}}>
										<input type="hidden" name="id" value={area.id} />
										<button type="submit" class="text-green-600 hover:text-green-800 mr-2">Guardar</button>
									</form>
									<button type="button" onclick={() => editingAreaId = null} class="text-gray-500 hover:text-gray-700">Cancelar</button>
								</td>
							</tr>
						{:else}
							<tr class="border-t hover:bg-gray-50">
								<td class="px-4 py-3">#{area.id}</td>
								<td class="px-4 py-3 font-medium">{area.nombre}</td>
								<td class="px-4 py-3 text-center">
									<span class="text-xs px-2 py-0.5 rounded {area.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
										{area.activo ? 'Activo' : 'Inactivo'}
									</span>
								</td>
								<td class="px-4 py-3 text-center text-gray-500">{data.areaProductCount[area.id] ?? 0}</td>
								{#if isAdmin}
									<td class="px-4 py-3 text-right">
										<button onclick={() => editingAreaId = area.id} class="text-blue-600 hover:text-blue-800 text-sm mr-2">Editar</button>
										<form method="POST" action="?/deleteArea" use:enhance class="inline">
											<input type="hidden" name="id" value={area.id} />
											<button type="submit" class="text-red-500 hover:text-red-700 text-sm" onclick={(e) => { if (!confirm('¿Eliminar esta área?')) e.preventDefault(); }}>Eliminar</button>
										</form>
									</td>
								{/if}
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
