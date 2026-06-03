import React, { useState, useEffect } from 'react'
import { 
  Package, 
  Calculator, 
  AlertTriangle, 
  CheckCircle, 
  Scale, 
  RefreshCw 
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'

interface IngredientCalculatorProps {
  batchId: string
  batchSize: number
  recipeId: string
  recipeName: string
}

interface CalculatedIngredient {
  name: string
  amount: number
  unit: string
  inStock: boolean
  stockAmount?: number
  inventoryId?: string
}

export default function IngredientCalculator({ batchId, batchSize, recipeId, recipeName }: IngredientCalculatorProps) {
  const [ingredients, setIngredients] = useState<CalculatedIngredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadIngredients()
  }, [batchId, batchSize, recipeId])

  const loadIngredients = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log(`Loading ingredients for recipe ${recipeId} with batch size ${batchSize}`)
      
      // First try to get recipe details from products table
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('ingredients, id')
        .eq('id', recipeId)
        .maybeSingle()
      
      if (productError) {
        console.log('Error loading product:', productError)
        toast.error('Hiba a termék betöltésekor')
        setError('Hiba a termék betöltésekor')
        setIngredients([])
        return
      }
      
      if (!productData || !productData?.ingredients || !Array.isArray(productData.ingredients)) {
        console.log('Product not found or has no ingredients, trying recipes table')
        
        // Try to load from recipes table as fallback
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes')
          .select('ingredients, id')
          .eq('id', recipeId)
          .maybeSingle()
          
        if (recipeError) {
          console.error('Error loading recipe:', recipeError)
          setError('Nem sikerült betölteni a recept hozzávalóit')
          setIngredients([])
          return
        }
        
        if (!recipeData || !recipeData?.ingredients || !Array.isArray(recipeData.ingredients)) { 
          setError('A recepthez nem találhatók hozzávalók')
          setIngredients([])
          return
        }
        
        await processIngredients(recipeData.ingredients) 
      } else if (productData && productData?.ingredients && Array.isArray(productData.ingredients)) {
        await processIngredients(productData.ingredients)
      } else {
        setError('A termékhez nem találhatók hozzávalók')
        setIngredients([])
      }
    } catch (error) {
      console.error('Hiba a hozzávalók számításakor:', error)
      setError('Hiba történt a hozzávalók számításakor')
      setIngredients([])
    } finally {
      setLoading(false)
    }
  }
  
  const processIngredients = async (ingredientsList: any[]) => {
    try {
      // Calculate required amounts based on batch size
      const calculatedIngredients = ingredientsList.map((ingredient: any) => { 
        // Handle comma-separated numbers in amount
        let amount = ingredient.amount;
        if (typeof amount === 'string') {
          // First remove thousand separators
          let cleanAmount = amount.replace(/(\d),(\d{3})/g, '$1$2');
          // Then convert decimal comma to point
          cleanAmount = cleanAmount.replace(/,/g, '.');
          amount = parseFloat(cleanAmount);
        }
        
        if (isNaN(amount)) {
          amount = 0;
          console.warn(`Invalid amount for ingredient ${ingredient.name}, defaulting to 0`);
        }
        
        // Calculate based on batch size - assuming recipe is for 100 units
        const baseAmount = amount;
        const scaleFactor = batchSize / 100; 
        amount = baseAmount * scaleFactor;
       
        return {
          name: ingredient.name,
          amount: amount,
          unit: ingredient.unit,
          inStock: false,
          stockAmount: 0,
          inventoryId: ''
        };
      });
      
      // Check inventory for each ingredient
      for (const ingredient of calculatedIngredients) {
        const { data: inventoryData, error: inventoryError } = await supabase 
          .from('inventory')
          .select('id, name, current_stock')
          .ilike('name', `%${ingredient.name}%`)
          .eq('unit', ingredient.unit)
          .limit(1);
        
        if (inventoryError) {
          console.error(`Error checking inventory for ${ingredient.name}:`, inventoryError);
          continue;
        }
        
        if (inventoryData && inventoryData.length > 0) {
          const inventoryItem = inventoryData[0];
          ingredient.inStock = inventoryItem.current_stock >= ingredient.amount; 
          ingredient.stockAmount = inventoryItem.current_stock;
          ingredient.inventoryId = inventoryItem.id;
        }
      }
      
      setIngredients(calculatedIngredients);
    } catch (error) {
      console.error('Error processing ingredients:', error);
      throw error;
    }
  };

  const updateInventory = async () => {
    try {
      setUpdating(true)
      console.log('Updating inventory for ingredients:', ingredients)
      
      // Update inventory for each ingredient
      for (const ingredient of ingredients) {
        if (!ingredient.inventoryId) {
          console.log(`No inventory item found for ${ingredient.name}, skipping`)
          continue
        }
        
        // Get current stock
        const { data: inventoryData, error: inventoryError } = await supabase 
          .from('inventory')
          .select('current_stock')
          .eq('id', ingredient.inventoryId)
          .single()
        
        if (inventoryError) {
          console.error(`Error getting inventory for ${ingredient.name}:`, inventoryError)
          toast.error(`Hiba a ${ingredient.name} készletének lekérdezésekor`)
          continue
        }
        
        if (!inventoryData) {
          console.log(`No inventory data found for ${ingredient.name}, skipping`)
          toast.error(`Nem található készletadat a ${ingredient.name} alapanyaghoz`)
          continue
        }
        
        // Calculate new stock
        const newStock = Math.max(0, inventoryData.current_stock - ingredient.amount)
        console.log(`Updating inventory for ${ingredient.name}: ${inventoryData.current_stock} -> ${newStock} ${ingredient.unit}`)
        
        // Update inventory
        const { error: updateError } = await supabase 
          .from('inventory')
          .update({ 
            current_stock: newStock,
            last_restocked: new Date().toISOString()
          })
          .eq('id', ingredient.inventoryId)
        
        if (updateError) {
          console.error(`Error updating inventory for ${ingredient.name}:`, updateError)
          toast.error(`Hiba a ${ingredient.name} készletének frissítésekor`)
          continue
        } else {
          console.log(`Updated inventory for ${ingredient.name}: ${inventoryData.current_stock} -> ${newStock} ${ingredient.unit}`)
        }
      }
      
      // Update batch status to completed
      const { error: batchError } = await supabase
        .from('production_batches')
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', batchId)
      
      if (batchError) {
        console.error('Error updating batch status:', batchError)
        toast.error('Hiba a gyártási tétel állapotának frissítésekor')
        return
      } else {
        // Get batch details to update production steps
        const { data: batchData, error: batchDataError } = await supabase
          .from('production_batches')
          .select('*')
          .eq('id', batchId)
          .single()
        
        if (batchDataError) {
          console.error('Error fetching batch data:', batchDataError)
        } else if (batchData) {
          // Update all production steps to completed
          const stepsUpdateData = { 
            status: 'completed',
            end_time: new Date().toISOString()
          }
          
          const { error: stepsError } = await supabase
            .from('production_steps')
            .update(stepsUpdateData)
            .eq('batch_id', batchId)
            .eq('status', 'in_progress')
          
          if (stepsError) {
            console.error('Error updating production steps:', stepsError)
          }
        }
        
        toast.success('Gyártási tétel és készlet sikeresen frissítve!')
      }
      
      // Reload ingredients to show updated stock levels
      loadIngredients()
    } catch (error) {
      console.error('Error updating inventory:', error)
      toast.error('Hiba a készlet frissítésekor')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (ingredients.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
          <p className="text-yellow-800 dark:text-yellow-300">Nincsenek hozzávalók a receptben</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Calculator className="h-5 w-5 mr-2 text-amber-600" />
          Hozzávalók kimérése
        </h2>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
            {recipeName} • {batchSize} db
          </span>
          <button
            onClick={loadIngredients}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Batch completion button */}
      <div className="mb-4">
        <button
          onClick={updateInventory}
          disabled={updating || ingredients.some(ing => !ing.inStock)}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {updating ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Frissítés...
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              Tétel befejezése és készlet frissítése
            </>
          )}
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Hozzávaló
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Szükséges mennyiség
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Készleten
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Állapot
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {ingredients.map((ingredient, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Package className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {ingredient.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Scale className="h-5 w-5 text-amber-600 mr-2" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {ingredient.amount.toFixed(2)} {ingredient.unit}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {ingredient.stockAmount !== undefined ? `${ingredient.stockAmount.toFixed(2)} ${ingredient.unit}` : 'Ismeretlen'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {ingredient.inStock ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Elegendő
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Hiány
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {ingredients.some(ing => !ing.inStock) && (
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Figyelmeztetés: Egyes hozzávalók hiányoznak a készletből
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Kérjük, ellenőrizze a készletet és szükség esetén rendeljen újra.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}