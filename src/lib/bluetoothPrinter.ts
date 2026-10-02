interface BluetoothCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
}

interface BluetoothService {
  getCharacteristic(uuid: string): Promise<BluetoothCharacteristic>;
}

interface BluetoothServer {
  connected: boolean;
  connect(): Promise<BluetoothServer>;
  getPrimaryService(uuid: string): Promise<BluetoothService>;
  disconnect(): void;
}

interface BluetoothDevice {
  name?: string;
  gatt?: BluetoothServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface BluetoothApi {
  requestDevice(options: {
    acceptAllDevices: boolean;
    optionalServices: string[];
  }): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth?: BluetoothApi;
  }
}

const printerProfiles = [
  {
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
  {
    service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
  {
    service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
] as const;

let selectedPrinter: BluetoothDevice | undefined;
let selectedProfile: (typeof printerProfiles)[number] | undefined;
let selectedCharacteristic: BluetoothCharacteristic | undefined;

export function isBluetoothPrinterSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function isBluetoothPrinterConnected(): boolean {
  return Boolean(selectedPrinter?.gatt?.connected && selectedCharacteristic);
}

export async function connectBluetoothPrinter(onDisconnect?: () => void): Promise<string> {
  const bluetooth = navigator.bluetooth;
  if (!bluetooth) {
    throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome di Android melalui HTTPS.');
  }

  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: printerProfiles.map(profile => profile.service),
  });
  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi Bluetooth GATT.');

  const server = await device.gatt.connect();
  for (const profile of printerProfiles) {
    try {
      const service = await server.getPrimaryService(profile.service);
      const characteristic = await service.getCharacteristic(profile.characteristic);
      if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
        continue;
      }

      selectedPrinter = device;
      selectedProfile = profile;
      selectedCharacteristic = characteristic;
      device.addEventListener('gattserverdisconnected', () => {
        if (selectedPrinter === device) {
          selectedPrinter = undefined;
          selectedProfile = undefined;
          selectedCharacteristic = undefined;
          onDisconnect?.();
        }
      });
      return device.name || 'POS80D';
    } catch {
      continue;
    }
  }

  server.disconnect();
  throw new Error('Layanan cetak BLE tidak ditemukan. Pastikan UUID printer cocok dengan profil POS80D.');
}

export async function printBluetoothReceipt(text: string): Promise<void> {
  if (!selectedPrinter?.gatt?.connected || !selectedProfile || !selectedCharacteristic) {
    throw new Error('Hubungkan printer Bluetooth sebelum mencetak.');
  }

  const server = selectedPrinter.gatt;
  const service = await server.getPrimaryService(selectedProfile.service);
  const characteristic = await service.getCharacteristic(selectedProfile.characteristic);
  const encoder = new TextEncoder();
  const receipt = encoder.encode(text.replace(/\u00a0/g, ' ').replace(/[^\x20-\x7e\r\n\t]/g, '?'));
  const payload = new Uint8Array(receipt.length + 5);
  payload.set([0x1b, 0x40]);
  payload.set(receipt, 2);
  payload.set([0x1d, 0x56, 0x00], receipt.length + 2);

  const chunkSize = 20;
  for (let offset = 0; offset < payload.length; offset += chunkSize) {
    const chunk = payload.slice(offset, offset + chunkSize);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}
