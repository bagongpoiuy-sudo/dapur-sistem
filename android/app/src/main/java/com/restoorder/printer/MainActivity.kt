package com.restoorder.printer

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.Normalizer
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.scheme == "https" && uri.host == APP_HOST) return false
                    if (uri.scheme != "https" && uri.scheme != "http") return true

                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
            }
            addJavascriptInterface(ReceiptPrinterBridge(), "AndroidReceiptPrinter")
            loadUrl(APP_URL)
        }
        setContentView(webView)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), BLUETOOTH_PERMISSION_REQUEST)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private inner class ReceiptPrinterBridge {
        @JavascriptInterface
        fun getPairedPrinters(): String {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
            ) {
                return errorJson("Izin Bluetooth belum diberikan. Izinkan akses Bluetooth lalu coba lagi.")
            }

            val adapter = getSystemService(BluetoothManager::class.java)?.adapter
                ?: return errorJson("Perangkat ini tidak mendukung Bluetooth.")
            if (!adapter.isEnabled) return errorJson("Aktifkan Bluetooth Android terlebih dahulu.")

            return try {
                JSONArray().apply {
                    adapter.bondedDevices
                        .sortedBy { it.name.orEmpty() }
                        .forEach { device ->
                            put(JSONObject().put("name", device.name ?: "Printer Bluetooth")
                                .put("address", device.address))
                        }
                }.toString()
            } catch (error: SecurityException) {
                errorJson("Izin Bluetooth ditolak. Izinkan akses Bluetooth di pengaturan aplikasi.")
            }
        }

        @JavascriptInterface
        fun printReceipt(address: String, text: String) {
            Thread {
                val result = try {
                    printToPairedPrinter(address, text)
                    "Struk berhasil dikirim ke printer."
                } catch (error: Exception) {
                    "Gagal mencetak: ${error.message ?: "periksa koneksi dan printer Bluetooth."}"
                }

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onReceiptPrintResult && window.onReceiptPrintResult(${JSONObject.quote(result)})",
                        null
                    )
                }
            }.start()
        }
    }

    private fun printToPairedPrinter(address: String, text: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
        ) {
            throw IOException("izin Bluetooth belum diberikan.")
        }

        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
            ?: throw IOException("perangkat ini tidak mendukung Bluetooth.")
        if (!adapter.isEnabled) throw IOException("Bluetooth Android belum aktif.")

        val device = adapter.bondedDevices.firstOrNull { it.address == address }
            ?: throw IOException("printer tidak ditemukan di daftar perangkat yang dipasangkan.")
        val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
        socket.use {
            it.connect()
            it.outputStream.use { output ->
                val printableText = Normalizer.normalize(text, Normalizer.Form.NFD)
                    .replace(Regex("\\p{M}+"), "")
                output.write(byteArrayOf(0x1B, 0x40))
                output.write(printableText.replace('\u00A0', ' ')
                    .replace(Regex("[^\\x20-\\x7E\\r\\n\\t]"), "?")
                    .toByteArray(Charsets.US_ASCII))
                output.write(byteArrayOf(0x1D, 0x56, 0x00))
                output.flush()
            }
        }
    }

    private fun errorJson(message: String) = JSONObject().put("error", message).toString()

    companion object {
        private const val APP_URL = "https://dapur-resto.vercel.app"
        private const val APP_HOST = "dapur-resto.vercel.app"
        private const val BLUETOOTH_PERMISSION_REQUEST = 1001
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
