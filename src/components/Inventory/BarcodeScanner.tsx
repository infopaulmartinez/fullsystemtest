import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Scan, QrCode, Barcode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'react-hot-toast'; 
import { supabase } from '../../lib/supabase';

interface BarcodeScannerProps {
  onScan: (data: string, type: 'barcode' | 'qrcode') => void;
  onClose: () => void;
  scanningFor?: 'search' | 'edit' | null;
}

export default function BarcodeScanner({ onScan, onClose, scanningFor = null }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanType, setScanType] = useState<'barcode' | 'qrcode'>('barcode');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{id: string, label: string}[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "html5-qrcode-scanner";
  
  useEffect(() => {
    // Request camera permission on component mount
    setTimeout(() => {
      requestPermission();
      loadCameras();
    }, 1000);
    
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const loadCameras = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }
      
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        setAvailableCameras(devices);
        setSelectedCamera(devices[0].id);
      } else {
        setError('Nem található kamera az eszközön');
      }
    } catch (err) {
      console.error('Error loading cameras:', err);
      setError('Hiba a kamerák betöltésekor: ' + err.message);
      handleError(err);
    }
  };

  const startScanner = async () => {
    try {
      setScanning(true);
      setError(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }

      // Stop any existing scan first
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      } 

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Ellenőrizzük, hogy a QR kód URL-e vagy egyszerű szöveg
        let scanValue = decodedText;
        try {
          // Ha URL, akkor kivonjuk az azonosítót
          if (decodedText.includes('szemesipekseg.hu/inventory/')) {
            const parts = decodedText.split('/');
            scanValue = parts[parts.length - 1];
          } else if (decodedText.includes('szemesipekseg.hu/orders/')) {
            const parts = decodedText.split('/');
            scanValue = parts[parts.length - 1];
          } else if (decodedText.includes('szemesipekseg.hu/products/')) {
            const parts = decodedText.split('/');
            scanValue = parts[parts.length - 1];
          } else if (decodedText.includes('szemesipekseg.hu/delivery/')) {
            const parts = decodedText.split('/');
            scanValue = parts[parts.length - 1];
          }
        } catch (e) {
          console.error('Error parsing QR code:', e);
        }
        
        if (scanningFor === 'search') {
          // Keresés a készletben
          checkInventoryItem(scanValue, scanType)
            .then(found => { 
              if (found) {
                onScan(scanValue, scanType);
              } else {
                // Próbáljuk meg a rendeléseket is ellenőrizni
                checkForOrder(scanValue);
              }
            })
            .catch(err => {
              console.error('Error checking inventory:', err);
              toast.error('Hiba a kód ellenőrzésekor');
            }); 
        } else {
          // Egyszerűen visszaadjuk a beolvasott értéket
          onScan(scanValue, scanType);
          toast.success(`${scanType === 'barcode' ? 'Vonalkód' : 'QR kód'} beolvasva`);
        }
        
        stopScanner();
      };
      
      const config = { 
        fps: 5, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport: scanType === 'barcode' ? 
          [
            0, // CODE_128
            1, // CODE_39
            2, // EAN_13
            3, // EAN_8
            4, // CODE_93
            5, // CODABAR
            6, // ITF
            7, // UPC_A
            8  // UPC_E
          ] : 
          [10] // QR_CODE 
      };

      // Wait for the DOM to be ready
      setTimeout(async () => {
        try {
          await scannerRef.current.start(
            { facingMode: "environment" }, 
            config,
            qrCodeSuccessCallback,
            undefined
          );

          setHasPermission(true);
          setError(null);
        } catch (err) {
          console.error('Error starting scanner:', err);
          setError('Hiba a kamera indításakor: ' + err.message);
          setScanning(false);
          handleError(err);
        }
      }, 500); 
    } catch (err) {
      console.error('Scanner error:', err);
      setScanning(false);
      handleError(err);
    }
  };

  const stopScanner = () => { 
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop()
        .then(() => {
          setScanning(false);
        })
        .catch(err => {
          console.error('Error stopping scanner:', err);
        });
    }
  }; 

  const requestPermission = async () => {
    try {
      setLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 }, 
          height: { ideal: 720 }
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setError(null);
      setTimeout(() => {
        startScanner();
      }, 500); 
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Készlet elem ellenőrzése a QR kód alapján
  const checkInventoryItem = async (itemId: string, type: 'barcode' | 'qrcode'): Promise<boolean> => {
    try { 
      // If the item is a JSON string, parse it
      let searchValue = itemId;
      try {
        const parsed = JSON.parse(itemId);
        if (parsed && parsed.id) {
          searchValue = parsed.id;
          
          // If we have a parsed object with type and id, we can directly return success
          if (parsed.type === 'product' || parsed.type === 'inventory') {
            const entityType = parsed.type === 'product' ? 'termék' : 'készlet tétel'; 
            toast.success(`${entityType} azonosítva: ${parsed.name}`);
            return true;
          }
        }
      } catch (e) {
        // Not JSON, continue with the original value
      }
      
      // Ellenőrizzük, hogy van-e ilyen elem a készletben
      const { data, error } = await supabase 
        .from('inventory')
        .select('id, name')
        .or(`${type === 'barcode' ? 'barcode' : 'qr_code'}.eq.${searchValue}`)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking inventory:', error);
        return false;
      } 
      
      if (data) {
        toast.success(`Termék megtalálva: ${data.name}`);
        return true;
      }
      
      // Check products table as well
      const { data: productData, error: productError } = await supabase 
        .from('products')
        .select('id, name')
        .or(`${type === 'barcode' ? 'barcode' : 'qr_code'}.eq.${searchValue}`)
        .maybeSingle();
      
      if (productError) {
        console.error('Error checking products:', productError);
        return false;
      } 
      
      if (productData) {
        toast.success(`Termék megtalálva: ${productData.name}`);
        return true;
      }
      
      return false;
    } catch (error) { 
      console.error('Error checking inventory item:', error);
      return false;
    }
  };
  
  // Rendelés ellenőrzése a QR kód alapján
  const checkForOrder = async (orderIdOrNumber: string) => {
    try {
      // Próbáljuk meg a rendelések táblából lekérdezni 
      const { data: orderData, error: orderError } = await supabase 
        .from('orders')
        .select('*')
        .or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`)
        .maybeSingle();
      
      if (orderError) {
        console.error('Error checking order:', orderError);
      } 
      
      if (orderData) {
        toast.success(`Rendelés megtalálva: ${orderData.order_number}`);
        // Itt lehetne navigálni a rendelés részleteihez
        return;
      }
      
      // Próbáljuk meg a webshop rendelések táblából lekérdezni
      const { data: webshopOrderData, error: webshopOrderError } = await supabase 
        .from('webshop_orders')
        .select('id, order_number, customer_name, status')
        .or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`)
        .maybeSingle();
      
      if (webshopOrderError) {
        console.error('Error checking webshop order:', webshopOrderError);
      } 
      
      if (webshopOrderData) {
        toast.success(`Webshop rendelés megtalálva: ${webshopOrderData.order_number}`);
        // Itt lehetne navigálni a webshop rendelés részleteihez
        return;
      }
      
      // Próbáljuk meg a production_batches táblából lekérdezni webshop_order_id alapján
      const { data: batchData, error: batchError } = await supabase 
        .from('production_batches')
        .select('id, batch_number, recipe_id, batch_size, status, webshop_order_id')
        .eq('webshop_order_id', orderIdOrNumber)
        .maybeSingle();
      
      if (batchError) {
        console.error('Error checking batch:', batchError);
      } 
      
      if (batchData) {
        toast.success(`Gyártási tétel megtalálva: ${batchData.batch_number}`);
        // Itt lehetne navigálni a gyártási tétel részleteihez
        return;
      }
      
      toast.error(`Nem található termék vagy rendelés ezzel a kóddal: ${orderIdOrNumber}`);
    } catch (error) { 
      console.error('Error checking for order:', error);
      toast.error('Hiba a kód ellenőrzésekor');
    }
  };

  const handleError = (err: any) => {
    console.error('Scanner error:', err);
    if (err.name === 'NotAllowedError') { 
      setHasPermission(false);
      setError('Kamera hozzáférés megtagadva. Kérjük engedélyezze a kamera használatát.');
    } else if (err.name === 'NotFoundError') {
      setError('Nem található kamera az eszközön.');
    } else {
      setError('Hiba történt a kamera használata közben: ' + (err.message || 'Ismeretlen hiba'));
    }
  }; 

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {scanType === 'barcode' ? 'Vonalkód beolvasása' : 'QR kód beolvasása'}
          </h3>
          <button 
            onClick={() => {
              stopScanner();
              onClose(); 
            }}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {hasPermission === false ? ( 
            <div className="text-center py-8">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                <p className="text-red-800 dark:text-red-300">{error}</p>
              </div>
              <button
                onClick={requestPermission}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              >
                <Camera className="h-4 w-4 mr-2" />
                Újrapróbálás
              </button>
            </div> 
          ) : error ? (
            <div className="text-center py-8">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                <p className="text-red-800 dark:text-red-300">{error}</p>
              </div>
              <button
                onClick={requestPermission}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
              >
                <Camera className="h-4 w-4 mr-2" />
                Újrapróbálás
              </button>
            </div> 
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex justify-center space-x-4 mb-4">
                <button
                  onClick={() => {
                    stopScanner();
                    setScanType('barcode');
                    setTimeout(startScanner, 100);
                  }} 
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    scanType === 'barcode'
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Barcode className="h-4 w-4 inline mr-2" />
                  Vonalkód
                </button>
                <button 
                  onClick={() => {
                    stopScanner();
                    setScanType('qrcode');
                    setTimeout(startScanner, 100);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    scanType === 'qrcode'
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <QrCode className="h-4 w-4 inline mr-2" />
                  QR kód
                </button>
              </div> 

              <div className="overflow-hidden rounded-lg flex-1">
                <div
                  id={scannerContainerId} 
                  className="w-full h-full min-h-[300px] max-w-full bg-gray-100 dark:bg-gray-700 rounded-lg relative"
                >
                  {!scanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={startScanner} 
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg"
                      >
                        <Scan className="h-4 w-4 mr-2 inline" />
                        Beolvasás indítása
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                <p>Irányítsa a kamerát a {scanType === 'barcode' ? 'vonalkódra' : 'QR kódra'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}