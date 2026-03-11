<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cart: Map<number, { id: number; nombre: string; precio: string; cantidad: number }> = $state(new Map());
	let metodoPago: string = $state('efectivo');
	let showSuccess = $state(false);
	let showCorteCaja = $state(false);
	let pinInput = $state('');
	let corteError = $state('');
	let montoReal = $state('');
	let selectedAreaId: number | null = $state(null);

	let filteredProducts = $derived(
		selectedAreaId === null
			? data.products
			: data.products.filter((p: any) => p.areaId === selectedAreaId)
	);

	let cartTotal = $derived(
		Array.from(cart.values()).reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
	);

	let cartArray = $derived(Array.from(cart.values()));

	function addToCart(product: { id: number; nombre: string; precio: string }) {
		const newCart = new Map(cart);
		const existing = newCart.get(product.id);
		if (existing) {
			newCart.set(product.id, { ...existing, cantidad: existing.cantidad + 1 });
		} else {
			newCart.set(product.id, { ...product, cantidad: 1 });
		}
		cart = newCart;
	}

	function removeFromCart(id: number) {
		const newCart = new Map(cart);
		newCart.delete(id);
		cart = newCart;
	}

	function updateQuantity(id: number, delta: number) {
		const newCart = new Map(cart);
		const item = newCart.get(id);
		if (!item) return;
		const newQty = item.cantidad + delta;
		if (newQty <= 0) {
			newCart.delete(id);
		} else {
			newCart.set(id, { ...item, cantidad: newQty });
		}
		cart = newCart;
	}

	function clearCart() {
		cart = new Map();
	}

	// Compute payment breakdown from shift orders
	let shiftEfectivo = $derived(
		data.shiftOrders.filter((o: any) => o.metodoPago === 'efectivo').reduce((s: number, o: any) => s + parseFloat(o.total), 0)
	);
	let shiftTarjeta = $derived(
		data.shiftOrders.filter((o: any) => o.metodoPago === 'tarjeta').reduce((s: number, o: any) => s + parseFloat(o.total), 0)
	);
	let shiftTransferencia = $derived(
		data.shiftOrders.filter((o: any) => o.metodoPago === 'transferencia').reduce((s: number, o: any) => s + parseFloat(o.total), 0)
	);
	let shiftTotal = $derived(shiftEfectivo + shiftTarjeta + shiftTransferencia);

	async function closeCaja() {
		corteError = '';
		try {
			const res = await fetch('/api/shifts/close', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin: pinInput, montoReal })
			});
			const result = await res.json();
			if (!res.ok) {
				corteError = result.error;
				return;
			}
			window.location.href = '/api/auth/logout';
		} catch {
			corteError = 'Error al cerrar turno';
		}
	}
</script>

<div class="flex h-full">
	<!-- Products Grid -->
	<div class="flex-1 p-4 overflow-y-auto bg-gray-50">
		<!-- Area Tabs -->
		<div class="flex gap-2 mb-4">
			<button
				onclick={() => selectedAreaId = null}
				class="px-3 py-1.5 text-sm rounded-lg transition-colors {selectedAreaId === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}"
			>
				Todas
			</button>
			{#each data.areas as area}
				<button
					onclick={() => selectedAreaId = area.id}
					class="px-3 py-1.5 text-sm rounded-lg transition-colors {selectedAreaId === area.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}"
				>
					{area.nombre}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
			{#each filteredProducts as product}
				<button
					onclick={() => addToCart(product)}
					class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow text-left border border-gray-200 hover:border-blue-400"
				>
					<div class="font-medium text-gray-800">{product.nombre}</div>
					{#if product.descripcion}
						<div class="text-xs text-gray-500 mt-0.5">{product.descripcion}</div>
					{/if}
					<div class="text-blue-600 font-bold text-lg">{'$'}{product.precio}</div>
					<div class="text-xs text-gray-400">Stock: {product.stock}</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Cart Sidebar -->
	<div class="w-80 bg-white border-l border-gray-200 flex flex-col">
		<div class="p-4 border-b border-gray-200">
			<h2 class="font-bold text-lg text-gray-800">Carrito</h2>
		</div>

		<div class="flex-1 overflow-y-auto p-4">
			{#if cartArray.length === 0}
				<p class="text-gray-400 text-center mt-8">Agrega productos</p>
			{:else}
				{#each cartArray as item (item.id)}
					<div class="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
						<div class="flex-1">
							<div class="text-sm font-medium">{item.nombre}</div>
							<div class="text-xs text-gray-500">{'$'}{item.precio} c/u</div>
						</div>
						<div class="flex items-center gap-2">
							<button onclick={() => updateQuantity(item.id, -1)} class="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold">-</button>
							<span class="w-6 text-center text-sm">{item.cantidad}</span>
							<button onclick={() => updateQuantity(item.id, 1)} class="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold">+</button>
							<button onclick={() => removeFromCart(item.id)} class="text-red-400 hover:text-red-600 ml-1 text-sm">✕</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Payment -->
		<div class="p-4 border-t border-gray-200 bg-gray-50">
			{#if form?.success}
				<div class="bg-green-100 text-green-700 px-3 py-2 rounded mb-3 text-sm">
					Venta #{form.orderId} - {'$'}{form.total}
				</div>
			{/if}

			{#if form?.error}
				<div class="bg-red-100 text-red-700 px-3 py-2 rounded mb-3 text-sm">
					{form.error}
				</div>
			{/if}

			<div class="flex justify-between items-center mb-3">
				<span class="font-bold text-lg">Total:</span>
				<span class="font-bold text-2xl text-blue-600">{'$'}{cartTotal.toFixed(2)}</span>
			</div>

			<div class="flex gap-1 mb-3">
				{#each ['efectivo', 'tarjeta', 'transferencia'] as metodo}
					<button
						onclick={() => metodoPago = metodo}
						class="flex-1 py-1.5 text-xs rounded capitalize transition-colors {metodoPago === metodo ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
					>
						{metodo}
					</button>
				{/each}
			</div>

			<form method="POST" action="?/cobrar" use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') clearCart();
				};
			}}>
				<input type="hidden" name="cart" value={JSON.stringify(cartArray)} />
				<input type="hidden" name="metodo_pago" value={metodoPago} />
				<button
					type="submit"
					disabled={cartArray.length === 0}
					class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
				>
					Cobrar {'$'}{cartTotal.toFixed(2)}
				</button>
			</form>

			<button
				onclick={() => showCorteCaja = true}
				class="w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 rounded-lg text-sm transition-colors"
			>
				Corte de Caja
			</button>
		</div>
	</div>
</div>

<!-- Corte de Caja Modal -->
{#if showCorteCaja}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
			<h3 class="text-lg font-bold mb-4">Corte de Caja</h3>

			<!-- Shift Summary -->
			<div class="bg-gray-50 rounded p-3 mb-4 text-sm space-y-1">
				<div class="flex justify-between">
					<span>Ventas del turno:</span>
					<span class="font-bold">{data.shiftOrders.length}</span>
				</div>
				<div class="border-t border-gray-200 pt-1 mt-1"></div>
				<div class="flex justify-between">
					<span>💵 Efectivo:</span>
					<span class="font-bold">{'$'}{shiftEfectivo.toFixed(2)}</span>
				</div>
				<div class="flex justify-between">
					<span>💳 Tarjeta:</span>
					<span class="font-bold">{'$'}{shiftTarjeta.toFixed(2)}</span>
				</div>
				<div class="flex justify-between">
					<span>🏦 Transferencia:</span>
					<span class="font-bold">{'$'}{shiftTransferencia.toFixed(2)}</span>
				</div>
				<div class="border-t border-gray-200 pt-1 mt-1"></div>
				<div class="flex justify-between text-base">
					<span class="font-bold">Total ventas:</span>
					<span class="font-bold text-blue-600">{'$'}{shiftTotal.toFixed(2)}</span>
				</div>
			</div>

			<div class="mb-4">
				<label for="montoReal" class="block text-sm font-medium text-gray-700 mb-1">Efectivo en caja</label>
				<input
					type="number"
					id="montoReal"
					bind:value={montoReal}
					step="0.01"
					min="0"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="0.00"
				/>
			</div>

			<div class="mb-4">
				<label for="pin" class="block text-sm font-medium text-gray-700 mb-1">PIN de Supervisor / Admin</label>
				<input
					type="password"
					id="pin"
					bind:value={pinInput}
					inputmode="numeric"
					maxlength="4"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
					placeholder="····"
				/>
			</div>

			{#if corteError}
				<div class="bg-red-100 text-red-700 px-3 py-2 rounded mb-3 text-sm">{corteError}</div>
			{/if}

			<div class="flex gap-3">
				<button
					onclick={() => { showCorteCaja = false; pinInput = ''; corteError = ''; }}
					class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg transition-colors"
				>
					Cancelar
				</button>
				<button
					onclick={closeCaja}
					class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
				>
					Cerrar Turno
				</button>
			</div>
		</div>
	</div>
{/if}
