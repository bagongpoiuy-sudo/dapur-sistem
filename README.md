# RestoOrder

Sistem pemesanan restoran dengan cetak struk ESC/POS melalui Bluetooth Low Energy.

## Cetak struk BLE

1. Buka web menggunakan Chrome di Android melalui HTTPS.
2. Di halaman Kasir, pilih **Hubungkan Printer** lalu pilih POS80D.
3. Pasangkan struk lewat **Preview** atau **Bayar & Simpan**.

Printer harus menampilkan layanan BLE dan characteristic tulis yang cocok dengan salah satu profil POS80D di `src/lib/bluetoothPrinter.ts`. Profil yang dikonfigurasi meliputi service `0x18F0`/characteristic `0x2AF1` serta dua UUID vendor. POS80D harus mendukung ESC/POS.
