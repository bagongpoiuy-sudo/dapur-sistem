export interface PairedBluetoothPrinter {
  name: string;
  address: string;
}

interface AndroidReceiptPrinter {
  getPairedPrinters(): string;
  printReceipt(address: string, text: string): void;
}

declare global {
  interface Window {
    AndroidReceiptPrinter?: AndroidReceiptPrinter;
    onReceiptPrintResult?: (message: string) => void;
  }
}

export function getPairedBluetoothPrinters(): PairedBluetoothPrinter[] {
  const bridge = window.AndroidReceiptPrinter;
  if (!bridge) throw new Error('Fitur Bluetooth hanya tersedia di aplikasi Android RestoOrder.');

  const result: unknown = JSON.parse(bridge.getPairedPrinters());
  if (!Array.isArray(result)) {
    const error = result && typeof result === 'object' && 'error' in result ? result.error : null;
    throw new Error(typeof error === 'string' ? error : 'Daftar printer Bluetooth tidak valid.');
  }

  return result.filter((printer): printer is PairedBluetoothPrinter =>
    typeof printer === 'object' && printer !== null &&
    'name' in printer && typeof printer.name === 'string' &&
    'address' in printer && typeof printer.address === 'string'
  );
}

export function printBluetoothReceipt(address: string, text: string): void {
  const bridge = window.AndroidReceiptPrinter;
  if (!bridge) throw new Error('Fitur Bluetooth hanya tersedia di aplikasi Android RestoOrder.');
  bridge.printReceipt(address, text);
}
