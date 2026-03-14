<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types.js';
	import { setupPrinter, printTicket, printComanda, isPrinterConnected } from '$lib/printer.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cart: Map<number, { id: number; nombre: string; precio: string; cantidad: number; areaId: number | null }> = $state(new Map());
	let metodoPago: string = $state('efectivo');
	let showSuccess = $state(false);
	let showCorteCaja = $state(false);
	let pinInput = $state('');
	let corteError = $state('');
	let montoReal = $state('');
	let selectedAreaId: number | null = $state(null);
	let searchQuery: string = $state('');

	// ── Printer state ──────────────────────────────────────────────────────────
	let printerConnected = $state(false);
	let toastMessage = $state('');
	let toastType: 'success' | 'error' | 'info' = $state('info');
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	// Comanda pendiente: se muestra el modal después de imprimir el ticket
	type ComandaPending = { orderId: number; items: { nombre: string; cantidad: number }[]; fecha: Date };
	let pendingComanda: ComandaPending | null = $state(null);

	async function printPendingComanda() {
		if (!pendingComanda) return;
		const data_ = pendingComanda;
		pendingComanda = null;
		try {
			await printComanda(data_);
			showToast('Comanda enviada ✓', 'success');
		} catch (err: unknown) {
			showToast(err instanceof Error ? err.message : 'Error al imprimir comanda', 'error');
		}
	}

	function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
		toastMessage = msg;
		toastType = type;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMessage = ''), 3500);
	}

	async function handleSetupPrinter() {
		try {
			await setupPrinter();
			printerConnected = true;
			showToast('Impresora conectada ✓', 'success');
		} catch (err: unknown) {
			printerConnected = false;
			showToast(err instanceof Error ? err.message : 'Error al conectar impresora', 'error');
		}
	}

	// ── Product / cart helpers ─────────────────────────────────────────────────
	let filteredProducts = $derived(() => {
		let result = selectedAreaId === null
			? data.products
			: data.products.filter((p: any) => p.areaId === selectedAreaId);
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter((p: any) =>
				p.nombre.toLowerCase().includes(q) ||
				(p.descripcion && p.descripcion.toLowerCase().includes(q))
			);
		}
		return result;
	});

	let cartTotal = $derived(
		Array.from(cart.values()).reduce((sum, item) => sum + parseFloat(item.precio) * item.cantidad, 0)
	);

	let cartArray = $derived(Array.from(cart.values()));

	function addToCart(product: { id: number; nombre: string; precio: string; areaId?: number | null }) {
		const newCart = new Map(cart);
		const existing = newCart.get(product.id);
		if (existing) {
			newCart.set(product.id, { ...existing, cantidad: existing.cantidad + 1 });
		} else {
			newCart.set(product.id, {
				id: product.id,
				nombre: product.nombre,
				precio: product.precio,
				areaId: product.areaId ?? null,
				cantidad: 1
			});
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

	// ── Shift / corte helpers ─────────────────────────────────────────────────
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

		<!-- Search Bar -->
		<div class="mb-4">
			<input
				type="text"
				placeholder="🔍 Buscar artículo por nombre o descripción..."
				bind:value={searchQuery}
				class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
			/>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
			{#each filteredProducts() as product}
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

			<!-- Printer setup button -->
			<button
				onclick={handleSetupPrinter}
				class="w-full mb-2 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border
					{printerConnected
						? 'bg-green-50 border-green-400 text-green-700 hover:bg-green-100'
						: 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}"
			>
				🖨️ {printerConnected ? 'Impresora conectada ✓' : 'Configurar Impresora'}
			</button>

			<form method="POST" action="?/cobrar" use:enhance={({ cancel }) => {
				// Si no hay impresora, preguntar si igualmente quieren cobrar
				if (!printerConnected) {
					const continuar = window.confirm(
						'⚠️ La impresora no está conectada.\n¿Deseas cobrar sin imprimir el ticket?'
					);
					if (!continuar) { cancel(); return; }
				}

				return async ({ result, update }) => {
					// Snapshot BEFORE update() clears the cart state
					const ticketItems = cartArray.map(i => ({
						nombre: i.nombre,
						cantidad: i.cantidad,
						precioUnitario: i.precio
					}));
					const ticketMetodo = metodoPago;

					// Items que necesitan comanda (área con imprimirComanda=true)
					const comandaItems = cartArray
						.filter(i => {
							const area = data.areas.find((a: any) => a.id === i.areaId);
							return area?.imprimirComanda === true;
						})
						.map(i => ({ nombre: i.nombre, cantidad: i.cantidad }));

					await update();

					if (result.type === 'success') {
						clearCart();
						const r = result.data as { orderId: number; total: string };
						try {
							if (printerConnected) {
								await printTicket({
									businessName: 'POS MDFZ',
									orderId: r.orderId,
									items: ticketItems,
									total: r.total,
									metodoPago: ticketMetodo,
									vendedor: data.shift?.userId?.toString() ?? 'Vendedor',
									fecha: new Date()
								});
								showToast('Ticket impreso ✓', 'success');
								printerConnected = isPrinterConnected();

								// En lugar de imprimir comanda automáticamente,
								// mostrar modal para que el usuario corte el papel primero
								if (comandaItems.length > 0) {
									pendingComanda = { orderId: r.orderId, items: comandaItems, fecha: new Date() };
								}
							}
						} catch (err: unknown) {
							showToast(
								err instanceof Error ? err.message : 'Error al imprimir ticket',
								'error'
							);
							printerConnected = isPrinterConnected();
						}
					}
				};
			}}>
				<input type="hidden" name="cart" value={JSON.stringify(cartArray)} />
				<input type="hidden" name="metodo_pago" value={metodoPago} />
				<button
					type="submit"
					disabled={cartArray.length === 0}
					class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
				>
					{printerConnected ? '🖨️ Cobrar e Imprimir' : 'Cobrar'} {'$'}{cartTotal.toFixed(2)}
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

<!-- Toast notification -->
{#if toastMessage}
	<div
		class="fixed bottom-5 right-5 z-[100] max-w-xs px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium
			{toastType === 'success' ? 'bg-green-600' : toastType === 'error' ? 'bg-red-600' : 'bg-gray-800'}"
		role="alert"
	>
		{toastMessage}
	</div>
{/if}

<!-- Comanda confirmation modal -->
{#if pendingComanda}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
			<div class="text-center mb-4">
				<div class="text-4xl mb-2">✂️</div>
				<h3 class="text-lg font-bold text-gray-800">Corta el papel</h3>
				<p class="text-sm text-gray-500 mt-1">
					Cuando hayas separado el ticket del cliente, presiona el botón para imprimir la comanda de cocina.
				</p>
			</div>

			<!-- Preview of comanda items -->
			<div class="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1 border border-dashed border-gray-300">
				<div class="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
					🖨️ Comanda #{pendingComanda.orderId}
				</div>
				{#each pendingComanda.items as item}
					<div class="flex justify-between font-medium">
						<span>{item.nombre}</span>
						<span class="text-blue-600">×{item.cantidad}</span>
					</div>
				{/each}
			</div>

			<div class="flex gap-3">
				<button
					onclick={() => pendingComanda = null}
					class="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
				>
					Cancelar
				</button>
				<button
					onclick={printPendingComanda}
					class="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
				>
					🖨️ Imprimir Comanda
				</button>
			</div>
		</div>
	</div>
{/if}

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
