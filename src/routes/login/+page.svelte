<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();
</script>

<div class="min-h-screen bg-gray-100 flex items-center justify-center">
	<div class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
		<h1 class="text-2xl font-bold text-center mb-6 text-gray-800">POS - Iniciar Sesión</h1>

		{#if form?.error}
			<div class="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm">
				{form.error}
			</div>
		{/if}

		<form method="POST" use:enhance>
			<div class="mb-4">
				<label for="username" class="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
				<input
					type="text"
					id="username"
					name="username"
					required
					autocomplete="username"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="Nombre de usuario"
				/>
			</div>

			<div class="mb-6">
				<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					inputmode="numeric"
					maxlength="4"
					autocomplete="current-password"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
					placeholder="····"
				/>
			</div>

			<button
				type="submit"
				class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
			>
				Entrar
			</button>
		</form>
	</div>
</div>
