# RestoOrder Printer untuk Android

Aplikasi ini membuka `https://dapur-resto.vercel.app` di WebView dan mengirim struk kasir ke printer Bluetooth Classic melalui profil serial (SPP).

## Menyiapkan printer

1. Pasangkan POS80D dari **Pengaturan Android > Bluetooth**. Berikan izin Bluetooth saat aplikasi memintanya.
2. Buka aplikasi RestoOrder Printer dan masuk ke halaman **Kasir**.
3. Tekan **Cari Printer**, lalu pilih POS80D dari daftar perangkat yang sudah dipasangkan.
4. Tekan **Bayar & Simpan** atau **Preview** untuk mencetak.

## Membuat APK

Buka folder `android` di Android Studio dengan Android SDK 35 dan JDK 17, lalu jalankan **Build > Build APK(s)**. APK debug akan tersedia di `android/app/build/outputs/apk/debug/app-debug.apk`.

Perubahan antarmuka web perlu di-deploy ke Vercel agar tersedia di URL yang dibuka aplikasi. Jika printer tidak mendukung Bluetooth SPP atau ESC/POS standar, kompatibilitasnya memerlukan protokol/SDK dari produsennya.
