import React, { useEffect, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { QrCode, Barcode, Download, X, Save, Check, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface BarcodeGeneratorProps {
  value: string;
  type: 'barcode' | 'qrcode';
  inventoryId?: string;
  productId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function BarcodeGenerator({ value, type, inventoryId, productId, onClose, onSaved }: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printable, setPrintable] = useState(false);

  useEffect(() => {
    if (!value) return;

    try {
      if (type === 'qrcode' && canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, value, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        }).catch(error => {
          console.error('QR kód generálási hiba:', error);
          toast.error('Hiba a QR kód generálásakor');
        });
      } else if (type === 'barcode' && svgRef.current) {
        try {
          JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width: 2,
            height: 100,
            displayValue: true,
            fontSize: 16,
            margin: 10
          });
        } catch (error) {
          console.error('Vonalkód generálási hiba:', error);
          toast.error('Hiba a vonalkód generálásakor');
        }
      }
    } catch (error) {
      console.error('Kód generálási hiba:', error);
      toast.error('Hiba a kód generálásakor');
    }
  }, [value, type]);

  const downloadCode = () => {
    try {
      let link = document.createElement('a');
      let fileName = `${type}-${value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
      
      if (type === 'qrcode' && canvasRef.current) {
        link.download = `${fileName}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
      } else if (type === 'barcode' && svgRef.current) {
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        link.download = `${fileName}.svg`;
        link.href = URL.createObjectURL(svgBlob);
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up object URL
      if (link.href.startsWith('blob:')) {
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      console.error('Letöltési hiba:', error);
      toast.error('Hiba a letöltés során');
    }
  };

  const saveToDatabase = async () => {
    try {
      setSaving(true);
      
      if (inventoryId) {
        // Save to inventory item
        const updateData = type === 'barcode' 
          ? { barcode: value }
          : { qr_code: value };
          
        const { error } = await supabase
          .from('inventory')
          .update(updateData)
          .eq('id', inventoryId);
          
        if (error) {
          console.error('Error saving to inventory:', error);
          toast.error('Hiba a kód mentésekor');
          return;
        }
        
        toast.success(`${type === 'barcode' ? 'Vonalkód' : 'QR kód'} sikeresen mentve az adatbázisba!`);
      } else if (productId) {
        // Save to product
        const updateData = type === 'barcode' 
          ? { barcode: value }
          : { qr_code: value };
          
        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId);
          
        if (error) {
          console.error('Error saving to product:', error);
          toast.error('Hiba a kód mentésekor');
          return;
        }
        
        toast.success(`${type === 'barcode' ? 'Vonalkód' : 'QR kód'} sikeresen mentve az adatbázisba!`);
      } else {
        toast.error('Nincs megadva termék vagy készlet azonosító');
        return;
      }
      
      setSaved(true);
      
      if (onSaved) {
        onSaved();
      }
      
      // Close after a short delay to show success state
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving code:', error);
      toast.error('Hiba a kód mentésekor');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    setPrintable(true);
    setTimeout(() => {
      window.print();
      setPrintable(false);
    }, 100);
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 ${printable ? 'print:bg-white print:p-0' : ''}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl max-w-md w-full overflow-hidden ${printable ? 'print:shadow-none print:max-w-full print:rounded-none' : ''}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center print:hidden">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {type === 'barcode' ? 'Generált vonalkód' : 'Generált QR kód'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg mb-4 print:p-0 print:bg-transparent">
            {type === 'qrcode' ? (
              <canvas 
                ref={canvasRef} 
                className="mx-auto"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            ) : (
              <svg 
                ref={svgRef} 
                className="mx-auto" 
                width="300" 
                height="150"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            )}
          </div>
          
          <div className="text-center mb-4 print:mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-black">
              {type === 'barcode' ? 'Vonalkód' : 'QR kód'} értéke:
            </p>
            <p className="font-mono text-gray-900 dark:text-white break-all print:text-black text-sm">
              {value}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center print:hidden">
            {!saved ? (
              <>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Nyomtatás
                </button>
                <button
                  onClick={downloadCode}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Letöltés
                </button>
                
                {(inventoryId || productId) && (
                  <button
                    onClick={saveToDatabase}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Mentés...' : 'Mentés adatbázisba'}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                <Check className="h-4 w-4 mr-2" />
                Mentve! Bezárás
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}