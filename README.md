# RestoOrder

Sistem pemesanan restoran dengan cetak struk ESC/POS melalui Bluetooth Low Energy.

## Cetak struk BLE

1. Buka web menggunakan Chrome di Android melalui HTTPS.
2. Di halaman Kasir, pilih **Hubungkan Printer** lalu pilih POS80D.
3. Pasangkan struk lewat **Preview** atau **Bayar & Simpan**.

Printer harus menampilkan layanan BLE dan characteristic tulis yang cocok dengan salah satu profil POS80D di `src/lib/bluetoothPrinter.ts`. Profil yang dikonfigurasi meliputi service `0x18F0`/characteristic `0x2AF1` serta dua UUID vendor. POS80D harus mendukung ESC/POS.

## Database

Sebelum menggunakan input nama pelanggan, jalankan migrasi `supabase/migrations/20261003200000_add_customer_name_to_orders_and_receipts.sql` pada database Supabase.
Untuk diskon menu, jalankan juga `supabase/migrations/20261004110000_add_menu_discount_percent.sql`. Diskon dimasukkan sebagai persentase 0-100; harga pelanggan adalah harga menu setelah diskon dan dibulatkan ke Rupiah penuh.

## Edit pesanan dan riwayat nota

Pesanan yang belum dibayar dapat diedit dari halaman Kasir: jumlah item bisa diubah, item bisa dihapus, dan menu tersedia bisa ditambahkan. Pesanan tambahan untuk dapur Cafe/Restoran harus diselesaikan dapur sebelum pembayaran diaktifkan. Tab **Riwayat Pesanan** di Laporan menampilkan nota tersimpan secara berhalaman dan memungkinkan koreksi informasi serta item nota; total dan rekap laporan dihitung ulang setelah koreksi.
Riwayat nota dapat ditampilkan per hari kalender atau per minggu, dengan navigasi ke periode sebelumnya dan pencarian pada periode yang sedang dibuka.
