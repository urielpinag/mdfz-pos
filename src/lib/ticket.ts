/**
 * ESC/POS thermal printer ticket generator.
 * Generates a Uint8Array buffer ready to send via WebUSB.
 *
 * Usage (client-side via WebUSB):
 *   const device = await navigator.usb.requestDevice({ filters: [] });
 *   await device.open();
 *   await device.selectConfiguration(1);
 *   await device.claimInterface(0);
 *   const buffer = generateTicket({ ... });
 *   await device.transferOut(1, buffer);
 */

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
	INIT: [ESC, 0x40], // Initialize printer
	ALIGN_CENTER: [ESC, 0x61, 0x01],
	ALIGN_LEFT: [ESC, 0x61, 0x00],
	ALIGN_RIGHT: [ESC, 0x61, 0x02],
	BOLD_ON: [ESC, 0x45, 0x01],
	BOLD_OFF: [ESC, 0x45, 0x00],
	DOUBLE_HEIGHT: [GS, 0x21, 0x10],
	NORMAL_SIZE: [GS, 0x21, 0x00],
	CUT: [GS, 0x56, 0x00], // Full cut
	FEED: [ESC, 0x64, 0x03] // Feed 3 lines
};

interface TicketItem {
	nombre: string;
	cantidad: number;
	precioUnitario: string;
}

interface TicketData {
	businessName?: string;
	orderId: number;
	items: TicketItem[];
	total: string;
	metodoPago: string;
	vendedor: string;
	fecha: Date;
}

const encoder = new TextEncoder();

function text(str: string): number[] {
	return Array.from(encoder.encode(str));
}

function line(str: string): number[] {
	return [...text(str), LF];
}

function separator(width = 32): number[] {
	return line('-'.repeat(width));
}

function padLine(left: string, right: string, width = 32): number[] {
	const gap = width - left.length - right.length;
	const padding = gap > 0 ? ' '.repeat(gap) : ' ';
	return line(left + padding + right);
}

export function generateTicket(data: TicketData): Uint8Array {
	const buf: number[] = [];

	// Initialize
	buf.push(...CMD.INIT);

	// Header
	buf.push(...CMD.ALIGN_CENTER);
	buf.push(...CMD.BOLD_ON);
	buf.push(...CMD.DOUBLE_HEIGHT);
	buf.push(...line(data.businessName ?? 'POS MDFZ'));
	buf.push(...CMD.NORMAL_SIZE);
	buf.push(...CMD.BOLD_OFF);
	buf.push(LF);

	// Order info
	buf.push(...line(`Ticket #${data.orderId}`));
	buf.push(...line(data.fecha.toLocaleString('es-MX')));
	buf.push(...line(`Atendio: ${data.vendedor}`));

	// Items
	buf.push(...CMD.ALIGN_LEFT);
	buf.push(...separator());

	for (const item of data.items) {
		const subtotal = (item.cantidad * parseFloat(item.precioUnitario)).toFixed(2);
		buf.push(...line(`${item.cantidad}x ${item.nombre}`));
		buf.push(...padLine(`   $${item.precioUnitario} c/u`, `$${subtotal}`));
	}

	buf.push(...separator());

	// Total
	buf.push(...CMD.BOLD_ON);
	buf.push(...CMD.DOUBLE_HEIGHT);
	buf.push(...padLine('TOTAL:', `$${data.total}`));
	buf.push(...CMD.NORMAL_SIZE);
	buf.push(...CMD.BOLD_OFF);

	// Payment method
	buf.push(...padLine('Pago:', data.metodoPago.toUpperCase()));
	buf.push(...separator());

	// Footer
	buf.push(...CMD.ALIGN_CENTER);
	buf.push(LF);
	buf.push(...line('Gracias por su compra'));
	buf.push(LF);

	// Feed and cut
	buf.push(...CMD.FEED);
	buf.push(...CMD.CUT);

	return new Uint8Array(buf);
}
