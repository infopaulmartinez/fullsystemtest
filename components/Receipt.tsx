import React from 'react';

interface ReceiptProps {
  receiptData: any; // A tranzakció vagy visszáru adatait tartalmazó objektum
  type: 'sale' | 'return';
}

const Receipt: React.FC<ReceiptProps> = ({ receiptData, type }) => {
  const isSale = type === 'sale';
  const title = isSale ? 'NYUGTA' : 'VISSZÁRU BIZONYLAT';
  const transaction = isSale ? receiptData : receiptData.return;
  const items = receiptData.items || [];
  const total = isSale ? receiptData.total_amount : receiptData.total_amount;

  return (
    <div className="bg-white text-black p-6 rounded-lg font-mono text-sm leading-relaxed w-[302px]"> {/* 80mm-es blokknyomtatóhoz igazítva */}
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg">Szemesi Pékség</h3>
        <p className="text-xs">{receiptData.location_name || 'Balatonföldvár Üzlet'}</p>
        <p className="text-xs">Adószám: 12345678-1-42</p>
      </div>
      <div className="text-center my-4">
        <h4 className="font-bold">{title}</h4>
        <p className="text-xs">{transaction.transaction_number || transaction.return_number}</p>
        <p className="text-xs">{new Date(transaction.created_at).toLocaleString('hu-HU')}</p>
        {receiptData.original_transaction && <p className="text-xs mt-1">Eredeti tranzakció: {receiptData.original_transaction}</p>}
      </div>
      <div className="border-t border-b border-dashed border-black my-2 py-1">
        <div className="flex justify-between font-bold">
          <span>Termék</span>
          <span>Összeg</span>
        </div>
      </div>
      <div className="space-y-1">
        {items.map((item: any, index: number) => (
          <div key={index}>
            <div className="flex justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span>{item.total.toLocaleString('hu-HU')} Ft</span>
            </div>
            {item.quantity > 1 && (
              <div className="text-xs text-gray-600 pl-2">
                {item.unit_price.toLocaleString('hu-HU')} Ft/db
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black mt-2 pt-2">
        {isSale && receiptData.discount > 0 && (
           <div className="flex justify-between">
             <span>Részösszeg:</span>
             <span>{(total / (1 - receiptData.discount / 100)).toLocaleString('hu-HU')} Ft</span>
           </div>
        )}
        {isSale && receiptData.discount > 0 && (
            <div className="flex justify-between">
                <span>Kedvezmény ({receiptData.discount}%):</span>
                <span>-{( (total / (1 - receiptData.discount / 100)) - total ).toLocaleString('hu-HU')} Ft</span>
            </div>
        )}
        <div className="flex justify-between font-bold text-base mt-1">
          <span>{isSale ? 'Végösszeg:' : 'Visszatérítés:'}</span>
          <span>{total.toLocaleString('hu-HU')} Ft</span>
        </div>
      </div>
      <div className="border-t border-dashed border-black mt-2 pt-2 text-xs">
        <p>Fizetés módja: {isSale ? receiptData.paymentMethod : receiptData.refund_method}</p>
        <p>Pénztáros: {receiptData.cashier_name || 'Ismeretlen'}</p>
      </div>
      <div className="text-center mt-4">
        <p className="font-bold">Köszönjük a vásárlást!</p>
        <p className="text-xs">www.szemesipekseg.hu</p>
      </div>
    </div>
  );
};

export default Receipt;