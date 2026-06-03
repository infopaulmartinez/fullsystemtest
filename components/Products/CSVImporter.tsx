import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface CSVImporterProps {
  onImportComplete: () => void;
  onCancel: () => void;
}

export default function CSVImporter({ onImportComplete, onCancel }: CSVImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check if it's a CSV file
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Csak CSV fájlok támogatottak');
        return;
      }
      
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        // Get headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Parse data (up to 5 rows for preview)
        const data = [];
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          if (!lines[i].trim()) continue;
          
          // Handle quoted fields with commas inside
          const row: Record<string, string> = {};
          let currentField = '';
          let inQuotes = false;
          let currentHeader = 0;
          
          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // End of field
              row[headers[currentHeader]] = currentField.replace(/"/g, '');
              currentField = '';
              currentHeader++;
            } else {
              currentField += char;
            }
          }
          
          // Add the last field
          if (currentHeader < headers.length) {
            row[headers[currentHeader]] = currentField.replace(/"/g, '');
          }
          
          data.push(row);
        }
        
        setPreview(data);
        setError(null);
      } catch (error) {
        console.error('CSV parsing error:', error);
        setError('Hiba a CSV fájl feldolgozásakor');
      }
    };
    
    reader.onerror = () => {
      setError('Hiba a fájl olvasásakor');
    };
    
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file) return;
    
    try {
      setImporting(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          
          // Get headers
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          // Parse all data rows
          const products = [];
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Handle quoted fields with commas inside
            const row: Record<string, any> = {};
            let currentField = '';
            let inQuotes = false;
            let currentHeader = 0;
            
            for (let j = 0; j < lines[i].length; j++) {
              const char = lines[i][j];
              
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                // End of field
                row[headers[currentHeader]] = currentField.replace(/"/g, '');
                currentField = '';
                currentHeader++;
              } else {
                currentField += char;
              }
            }
            
            // Add the last field
            if (currentHeader < headers.length) {
              row[headers[currentHeader]] = currentField.replace(/"/g, '');
            }
            
            // Parse special fields
            try {
              if (row.ingredients) row.ingredients = JSON.parse(row.ingredients);
              if (row.instructions) row.instructions = JSON.parse(row.instructions);
              if (row.allergens) row.allergens = JSON.parse(row.allergens);
              if (row.nutritional_info) row.nutritional_info = JSON.parse(row.nutritional_info);
              
              // Convert boolean strings to actual booleans
              if (row.is_gluten_free) row.is_gluten_free = row.is_gluten_free === 'true';
              if (row.is_dairy_free) row.is_dairy_free = row.is_dairy_free === 'true';
              if (row.is_egg_free) row.is_egg_free = row.is_egg_free === 'true';
              if (row.is_vegan) row.is_vegan = row.is_vegan === 'true';
              if (row.ai_generated) row.ai_generated = row.ai_generated === 'true';
              
              // Convert numeric strings to numbers
              if (row.prep_time) row.prep_time = Number(row.prep_time);
              if (row.bake_time) row.bake_time = Number(row.bake_time);
              if (row.yield_amount) row.yield_amount = Number(row.yield_amount);
              if (row.cost_per_unit) row.cost_per_unit = Number(row.cost_per_unit);
              if (row.wholesale_price) row.wholesale_price = Number(row.wholesale_price);
              if (row.retail_price) row.retail_price = Number(row.retail_price);
              if (row.shelf_life) row.shelf_life = Number(row.shelf_life);
              if (row.weight_per_unit) row.weight_per_unit = Number(row.weight_per_unit);
              if (row.avg_rating) row.avg_rating = Number(row.avg_rating);
              if (row.review_count) row.review_count = Number(row.review_count);
            } catch (e) {
              console.error('Error parsing JSON fields:', e);
            }
            
            products.push(row);
          }
          
          // Insert products into database
          for (const product of products) {
            const { error } = await supabase
              .from('products')
              .upsert(product, { onConflict: 'id' });
            
            if (error) {
              console.error('Error inserting product:', error);
            }
          }
          
          toast.success(`${products.length} termék sikeresen importálva!`);
          onImportComplete();
        } catch (error) {
          console.error('CSV import error:', error);
          setError('Hiba a CSV fájl importálásakor');
        } finally {
          setImporting(false);
        }
      };
      
      reader.onerror = () => {
        setError('Hiba a fájl olvasásakor');
        setImporting(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      setError('Hiba az importálás során');
      setImporting(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">CSV Importálás</h2>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 dark:hover:border-amber-500"
        >
          <Upload className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Kattintson a CSV fájl feltöltéséhez</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">vagy húzza ide a fájlt</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv"
        />
        {file && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Kiválasztott fájl: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
        )}
      </div>
      
      {preview.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Előnézet</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {Object.keys(preview[0]).slice(0, 5).map((header, index) => (
                    <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Object.keys(row).slice(0, 5).map((key, cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {typeof row[key] === 'object' ? JSON.stringify(row[key]).substring(0, 50) + '...' : String(row[key]).substring(0, 50)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Előnézet az első {preview.length} sorról (az első 5 oszlop látható)
          </p>
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Mégse
        </button>
        <button
          onClick={handleImport}
          disabled={importing || !file}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {importing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Importálás...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Importálás
            </>
          )}
        </button>
      </div>
    </div>
  );
}