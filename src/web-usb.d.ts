// Minimal WebUSB type declarations for TypeScript.
// This avoids needing @types/w3c-web-usb as an npm dependency.

interface USBDeviceFilter {
	vendorId?: number;
	productId?: number;
	classCode?: number;
	subclassCode?: number;
	protocolCode?: number;
	serialNumber?: string;
}

interface USBDeviceRequestOptions {
	filters: USBDeviceFilter[];
}

interface USBEndpoint {
	endpointNumber: number;
	direction: 'in' | 'out';
	type: 'bulk' | 'interrupt' | 'isochronous';
	packetSize: number;
}

interface USBAlternateInterface {
	alternateSetting: number;
	interfaceClass: number;
	interfaceSubclass: number;
	interfaceProtocol: number;
	interfaceName: string | null;
	endpoints: USBEndpoint[];
}

interface USBInterface {
	interfaceNumber: number;
	alternate: USBAlternateInterface;
	alternates: USBAlternateInterface[];
	claimed: boolean;
}

interface USBConfiguration {
	configurationValue: number;
	configurationName: string | null;
	interfaces: USBInterface[];
}

interface USBOutTransferResult {
	bytesWritten: number;
	status: 'ok' | 'stall' | 'babble';
}

interface USBDevice {
	vendorId: number;
	productId: number;
	deviceClass: number;
	deviceSubclass: number;
	deviceProtocol: number;
	deviceVersionMajor: number;
	deviceVersionMinor: number;
	deviceVersionSubminor: number;
	usbVersionMajor: number;
	usbVersionMinor: number;
	usbVersionSubminor: number;
	manufacturerName: string | null;
	productName: string | null;
	serialNumber: string | null;
	configuration: USBConfiguration | null;
	configurations: USBConfiguration[];
	opened: boolean;
	open(): Promise<void>;
	close(): Promise<void>;
	selectConfiguration(configurationValue: number): Promise<void>;
	claimInterface(interfaceNumber: number): Promise<void>;
	releaseInterface(interfaceNumber: number): Promise<void>;
	transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
	transferIn(endpointNumber: number, length: number): Promise<{ data: DataView; status: string }>;
}

interface USB {
	requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
	getDevices(): Promise<USBDevice[]>;
}

interface Navigator {
	usb: USB;
}
