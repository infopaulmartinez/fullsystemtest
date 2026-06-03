import React, { useState } from 'react';
import { Download, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface CSVExporterProps {
  onExportComplete: () => void;
  onCancel: () => void;
}

export default function CSVExporter({ onExportComplete, onCancel }: CSVExporterProps) {
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeAll: true,
    includeIngredients: true,
    includeInstructions: true,
    includeNutritionalInfo: true,
    includeAllergens: true
  });

  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Fetch all products
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        toast.error('Nincsenek exportálható termékek');
        return;
      }
      
      // Convert to CSV
      const headers = Object.keys(data[0]);
      
      // Filter headers based on options
      let filteredHeaders = headers;
      if (!exportOptions.includeAll) {
        filteredHeaders = headers.filter(header => {
          if (!exportOptions.includeIngredients && header === 'ingredients') return false;
          if (!exportOptions.includeInstructions && header === 'instructions') return false;
          if (!exportOptions.includeNutritionalInfo && header === 'nutritional_info') return false;
          if (!exportOptions.includeAllergens && header === 'allergens') return false;
          return true;
        });
      }
      
      // Create CSV content
      let csvContent = filteredHeaders.join(',') + '\n';
      
      data.forEach(product => {
        const row = filteredHeaders.map(header => {
          const value = product[header];
          
          // Handle special fields
          if (typeof value === 'object' && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          
          // Handle strings with commas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          
          return value !== null && value !== undefined ? value : '';
        }).join(',');
        
        csvContent += row + '\n';
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${data.length} termék sikeresen exportálva!`);
      onExportComplete();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Hiba az exportálás során');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">CSV Exportálás</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Exportálási beállítások</h3>
        
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={exportOptions.includeAll}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeAll: e.target.checked }))}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Minden mező exportálása</span>
          </label>
          
          {!exportOptions.includeAll && (
            <div className="pl-6 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeIngredients}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeIngredients: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Hozzávalók</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeInstructions}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeInstructions: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Elkészítési utasítások</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeNutritionalInfo}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeNutritionalInfo: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Tápértékadatok</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeAllergens}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeAllergens: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Allergének</span>
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Az exportálás CSV formátumban történik, amely megnyitható Excel vagy más táblázatkezelő programmal.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
              A fájl tartalmazza az összes terméket az adatbázisból a kiválasztott mezőkkel.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Mégse
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {exporting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Exportálás...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Exportálás
            </>
          )}
        </button>
      </div>
    </div>
  );
}