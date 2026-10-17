import { CashierReceipt, Kitchen, KITCHEN_LABELS, formatCurrency } from './supabase';
import { isBluetoothPrinterConnected, isBluetoothPrinterSupported, printBluetoothReceipt } from './bluetoothPrinter';

export type PaymentMethod = 'cash' | 'qris' | 'transfer';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
};

interface ReceiptPrintData {
  receipt_number: string;
  table_number: string;
  waiter_name: string;
  customer_name?: string;
  cashier_name?: string;
  total_amount: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  items_snapshot: CashierReceipt['items_snapshot'];
  paid_at: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export function printReceipt(receipt: ReceiptPrintData): void {
  const kitchens: Kitchen[] = ['cafe', 'pastry', 'prasmanan', 'restoran'];
  const grouped = kitchens.reduce<Record<string, typeof receipt.items_snapshot>>((acc, kitchen) => {
    acc[kitchen] = receipt.items_snapshot.filter(item => item.kitchen === kitchen);
    return acc;
  }, {});
  const total = Number(receipt.total_amount);
  const amountPaid = Number(receipt.amount_paid ?? total);
  const paymentMethod = receipt.payment_method ?? 'cash';
  const paymentLabel = PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
  const change = Math.max(0, amountPaid - total);
  const paidAt = new Date(receipt.paid_at).toLocaleString('id-ID');

  if (isBluetoothPrinterSupported()) {
    if (!isBluetoothPrinterConnected()) {
      throw new Error('Hubungkan printer Bluetooth terlebih dahulu sebelum mencetak struk.');
    }

    const width = 48;
    const line = (left: string, right: string) =>
      `${left.slice(0, Math.max(0, width - right.length)).padEnd(Math.max(0, width - right.length))}${right}`;
    const text = [
      'Resto Kecombrang',
      'Jl. Pakem - Kalasan, Kledoan,',
      'Selomartani, Kec. Kalasan,',
      'Kabupaten Sleman, Daerah Istimewa',
      'Yogyakarta 55571',
      'Struk Pembayaran',
      '-'.repeat(width),
      line('No. Struk', receipt.receipt_number),
      line('Meja', receipt.table_number),
      ...(receipt.customer_name ? [line('Pelanggan', receipt.customer_name)] : []),
      line('Pelayan', receipt.waiter_name),
      line('Kasir', receipt.cashier_name || ''),
      line('Waktu', paidAt),
      '-'.repeat(width),
      ...kitchens.flatMap(kitchen => grouped[kitchen]?.length
        ? [`[${KITCHEN_LABELS[kitchen]}]`, ...grouped[kitchen].map(item =>
          `${item.quantity}x ${item.name} @ ${formatCurrency(item.price)}\n${line('', formatCurrency(item.subtotal))}`
        )]
        : []),
      '-'.repeat(width),
      line('TOTAL', formatCurrency(total)),
      line('Pembayaran', paymentLabel),
      line('Dibayar', formatCurrency(amountPaid)),
      ...(paymentMethod === 'cash' ? [line('Kembalian', formatCurrency(change))] : []),
      '',
      'Terima kasih atas kunjungan Anda!',
      '',
      '',
    ].join('\n');

    void printBluetoothReceipt(text).catch((error: unknown) => {
      alert(error instanceof Error ? error.message : 'Gagal mengirim struk ke printer.');
    });
    return;
  }

  const html = `
<!DOCTYPE html><html><head><title>Struk #${escapeHtml(receipt.receipt_number)}</title>
<style>
  body{font-family:monospace;width:100%;max-width:380px;box-sizing:border-box;margin:0 auto;padding:16px;font-size:12px;}
  h2{text-align:center;margin:0;font-size:16px;}
  .address{text-align:center;margin:4px 0;font-size:10px;}
  .divider{border-top:1px dashed #000;margin:8px 0;}
  .row{display:flex;justify-content:space-between;gap:8px;}
  .row span:last-child{text-align:right;}
  .section-title{font-weight:bold;margin:6px 0 3px;}
  .total{font-weight:bold;font-size:14px;}
  .footer{text-align:center;margin-top:12px;font-size:11px;}
  @media print{body{max-width:380px;}}
</style></head><body>
<h2>Resto Kecombrang</h2>
<p class="address">Jl. Pakem - Kalasan, Kledoan, Selomartani, Kec. Kalasan, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55571</p>
<p style="text-align:center;margin:4px 0;">Struk Pembayaran</p>
<div class="divider"></div>
<div class="row"><span>No. Struk</span><span>${escapeHtml(receipt.receipt_number)}</span></div>
<div class="row"><span>Meja</span><span>${escapeHtml(receipt.table_number)}</span></div>
${receipt.customer_name ? `<div class="row"><span>Pelanggan</span><span>${escapeHtml(receipt.customer_name)}</span></div>` : ''}
<div class="row"><span>Pelayan</span><span>${escapeHtml(receipt.waiter_name)}</span></div>
<div class="row"><span>Kasir</span><span>${escapeHtml(receipt.cashier_name || '')}</span></div>
<div class="row"><span>Waktu</span><span>${escapeHtml(paidAt)}</span></div>
<div class="divider"></div>
${kitchens.filter(kitchen => grouped[kitchen]?.length).map(kitchen => `
<p class="section-title">[${escapeHtml(KITCHEN_LABELS[kitchen])}]</p>
${grouped[kitchen].map(item => `<div class="row"><span>${item.quantity}x ${escapeHtml(item.name)} @ ${formatCurrency(item.price)}</span><span>${formatCurrency(item.subtotal)}</span></div>`).join('')}
`).join('')}
<div class="divider"></div>
<div class="row total"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
<div class="row"><span>Pembayaran</span><span>${escapeHtml(paymentLabel)}</span></div>
<div class="row"><span>Dibayar</span><span>${formatCurrency(amountPaid)}</span></div>
${paymentMethod === 'cash' ? `<div class="row"><span>Kembalian</span><span>${formatCurrency(change)}</span></div>` : ''}
<div class="footer"><p>Terima kasih atas kunjungan Anda!</p></div>
</body></html>`;

  const windowToPrint = window.open('', '_blank');
  if (!windowToPrint) {
    throw new Error('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi.');
  }
  windowToPrint.document.write(html);
  windowToPrint.document.close();
  windowToPrint.print();
}
