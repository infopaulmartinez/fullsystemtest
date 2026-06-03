import React, { useState, useEffect, useRef } from 'react'
import { 
  ChefHat, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Clock, 
  Package,
  Save,
  X,
  RefreshCw,
  Upload,
  Image,
  Thermometer,
  Droplets,
  FileSpreadsheet
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import RecipeExcelImporter from '../components/Products/RecipeExcelImporter'

interface Recipe {
  id: string
  name: string
  description: string | null
  ingredients: any[]
  instructions: string[]
  prep_time: number
  bake_time: number
  difficulty: string
  category: string
  yield_amount: number
  cost_per_unit: number | null
  wholesale_price: number | null
  retail_price: number | null
  vat_percentage: number | null
  image_url: string | null
  created_at: string
  created_by: string | null
  created_by_name?: string
}

type StepType = 'prep' | 'kneading' | 'rest' | 'shaping' | 'proofing' | 'baking' | 'cooling'

interface RecipeStep {
  id: string
  recipe_id: string
  step_number: number
  title: string
  description: string
  duration_minutes: number
  temperature?: number
  humidity?: number
  type?: StepType
}

export default function Recipes() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showStepsModal, setShowStepsModal] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([])
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: [{ name: '', amount: '', unit: 'g' }],
    instructions: [''],
    prep_time: 0,
    bake_time: 0,
    difficulty: 'medium',
    category: '',
    yield_amount: 1,
    cost_per_unit: 0,
    wholesale_price: 0,
    retail_price: 0,
    vat_percentage: 18,
    display_name: ''
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ÚJ ÁLLAPOTOK A LÉPÉSEK KEZELÉSÉHEZ (Hozzáadva)
  const [showExcelImporter, setShowExcelImporter] = useState(false)

  // ÚJ ÁLLAPOTOK A LÉPÉSEK KEZELÉSÉHEZ (Hozzáadva)
  // eslint-disable-next-line no-irregular-whitespace
  const [showAddStepForm, setShowAddStepForm] = useState(false)
  const [editingStep, setEditingStep] = useState<RecipeStep | null>(null)
  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    duration_minutes: 15,
    temperature: '',
    humidity: '',
    type: 'prep' as StepType
  })

  useEffect(() => {
    loadRecipes()
    loadCategories()
  }, [])

  const loadRecipes = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles:created_by (full_name)
        `)
        .order('name')
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a receptek betöltésekor')
        return
      }
      
      if (data) {
        const formattedRecipes = data.map(recipe => ({
          ...recipe,
          created_by_name: recipe.profiles?.full_name
        }))
        setRecipes(formattedRecipes)
      }
    } catch (error) {
      console.error('Hiba a receptek betöltésekor:', error)
      toast.error('Hiba a receptek betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .order('category')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        const uniqueCategories = Array.from(new Set(data.map(item => item.category).filter(Boolean)))
        setCategories(['all', ...uniqueCategories])
      }
    } catch (error) {
      console.error('Hiba a kategóriák betöltésekor:', error)
    }
  }

  const loadRecipeSteps = async (recipeId: string) => {
    try {
      const { data, error } = await supabase
        .from('recipe_steps')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('step_number')
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a recept lépések betöltésekor')
        return
      }
      
      if (data) {
        setRecipeSteps(data)
      } else {
        setRecipeSteps([])
      }
    } catch (error) {
      console.error('Hiba a recept lépések betöltésekor:', error)
      toast.error('Hiba a recept lépések betöltésekor')
    }
  }

  const handleAddIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', amount: '', unit: 'g' }]
    }))
  }

  const handleRemoveIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const handleIngredientChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) => 
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    }))
  }

  const handleAddInstruction = () => {
    setFormData(prev => ({
      ...prev,
      instructions: [...prev.instructions, '']
    }))
  }

  const handleRemoveInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }))
  }

  const handleInstructionChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.map((instruction, i) => 
        i === index ? value : instruction
      )
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A kép mérete nem lehet nagyobb 5MB-nál')
        return
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Csak képfájlok tölthetők fel')
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`; 
      const { error: uploadError } = await supabase.storage
        .from('images') 
        .upload(filePath, file); 
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        toast.error(`Hiba a kép feltöltésekor: ${uploadError.message}`);
        return null;
      }
      const { data } = supabase.storage
        .from('images') 
        .getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error in uploadImage function:', error);
      toast.error('Váratlan hiba történt a képfeltöltés során.');
      return null;
    }
  };

  // ÚJ FUNKCIÓK A LÉPÉSEKHOZ (Hozzáadva)
  const STEP_TYPE_LABELS: Record<StepType, string> = {
    prep: '⚙️ Előkészítés / Kimérés',
    kneading: '🌀 Dagasztás',
    rest: '💤 Pihentetés',
    shaping: '✋ Formázás / Darabolás',
    proofing: '🌡️ Kelesztés',
    baking: '🔥 Sütés',
    cooling: '❄️ Hűtés / Csomagolás'
  }

  const openAddStep = () => {
    setEditingStep(null)
    setNewStep({ title: '', description: '', duration_minutes: 15, temperature: '', humidity: '', type: 'prep' })
    setShowAddStepForm(true)
  }

  const openEditStep = (step: RecipeStep) => {
    setEditingStep(step)
    setNewStep({
      title: step.title,
      description: step.description || '',
      duration_minutes: step.duration_minutes,
      temperature: step.temperature?.toString() || '',
      humidity: step.humidity?.toString() || '',
      type: (step.type || 'prep') as StepType
    })
    setShowAddStepForm(true)
  }

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipe) return;
    try {
      if (editingStep) {
        // UPDATE meglévő lépés
        const { error } = await supabase
          .from('recipe_steps')
          .update({
            title: newStep.title,
            description: newStep.description,
            duration_minutes: newStep.duration_minutes,
            temperature: newStep.temperature ? parseInt(newStep.temperature) : null,
            humidity: newStep.humidity ? parseInt(newStep.humidity) : null,
            type: newStep.type
          })
          .eq('id', editingStep.id);
        if (error) throw error;
        toast.success('Lépés frissítve');
      } else {
        // INSERT új lépés
        const nextNumber = recipeSteps.length > 0 ? Math.max(...recipeSteps.map(s => s.step_number)) + 1 : 1;
        const { error } = await supabase
          .from('recipe_steps')
          .insert([{
            recipe_id: selectedRecipe.id,
            step_number: nextNumber,
            title: newStep.title,
            description: newStep.description,
            duration_minutes: newStep.duration_minutes,
            temperature: newStep.temperature ? parseInt(newStep.temperature) : null,
            humidity: newStep.humidity ? parseInt(newStep.humidity) : null,
            type: newStep.type
          }]);
        if (error) throw error;
        toast.success('Lépés hozzáadva');
      }
      setNewStep({ title: '', description: '', duration_minutes: 15, temperature: '', humidity: '', type: 'prep' });
      setEditingStep(null);
      setShowAddStepForm(false);
      loadRecipeSteps(selectedRecipe.id);
    } catch (e: any) {
      console.error('Step save error:', e);
      toast.error('Hiba a mentéskor: ' + (e.message || ''));
    }
  }

  const handleDeleteStep = async (id: string) => {
    if (!confirm('Biztosan törli ezt a lépést?')) return;
    const { error } = await supabase.from('recipe_steps').delete().eq('id', id);
    if (!error) {
      toast.success('Lépés törölve');
      if (selectedRecipe) loadRecipeSteps(selectedRecipe.id);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (!formData.name) {
        toast.error('Kérjük adja meg a recept nevét')
        setLoading(false)
        return
      }
      const formattedIngredients = formData.ingredients.map(ing => ({
        name: ing.name,
        amount: parseFloat(ing.amount.replace(',', '.')),
        unit: ing.unit
      }))
      let imageUrl = editingRecipe?.image_url || null
      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }
      const recipeData = {
        name: formData.name,
        description: formData.description || null,
        ingredients: formattedIngredients,
        instructions: formData.instructions.filter(Boolean),
        prep_time: formData.prep_time,
        bake_time: formData.bake_time,
        difficulty: formData.difficulty,
        category: formData.category || 'egyéb',
        yield_amount: formData.yield_amount,
        cost_per_unit: formData.cost_per_unit || null,
        wholesale_price: formData.wholesale_price || null,
        retail_price: formData.retail_price || null,
        vat_percentage: formData.vat_percentage ?? 18,
        display_name: formData.display_name?.trim() || null,
        image_url: imageUrl,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }
      if (editingRecipe) {
        const { error } = await supabase
          .from('products')
          .update(recipeData)
          .eq('id', editingRecipe.id)
        if (error) throw error
        toast.success('Recept frissítve!')
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(recipeData)
          .select()
        if (error) throw error
        if (data && data.length > 0) {
          const recipeId = data[0].id
          const defaultSteps = [
            { recipe_id: recipeId, step_number: 1, title: 'Előkészítés', description: 'Alapanyagok kimérése', duration_minutes: 15 },
            { recipe_id: recipeId, step_number: 2, title: 'Dagasztás', description: 'Összekeverés', duration_minutes: 20 },
            { recipe_id: recipeId, step_number: 3, title: 'Kelesztés', description: 'Pihentetés', duration_minutes: 60, temperature: 30, humidity: 80 },
            { recipe_id: recipeId, step_number: 4, title: 'Formázás', description: 'Tészta formázása', duration_minutes: 15 },
            { recipe_id: recipeId, step_number: 5, title: 'Sütés', description: 'Sütés', duration_minutes: 30, temperature: 220 }
          ]
          await supabase.from('recipe_steps').insert(defaultSteps)
        }
        toast.success('Recept létrehozva!')
      }
      setShowAddModal(false); setEditingRecipe(null); resetForm(); loadRecipes();
    } catch (error) { toast.error('Hiba a mentéskor'); } finally { setLoading(false); }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Biztosan törölni szeretné ezt a receptet?')) {
      try {
        setLoading(true)
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) throw error
        toast.success('Recept törölve!')
        loadRecipes()
      } catch (error) { toast.error('Hiba a törléskor'); } finally { setLoading(false); }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', description: '', ingredients: [{ name: '', amount: '', unit: 'g' }],
      instructions: [''], prep_time: 0, bake_time: 0, difficulty: 'medium',
      category: '', yield_amount: 1, cost_per_unit: 0, wholesale_price: 0, retail_price: 0, vat_percentage: 18, display_name: ''
    })
    setImageFile(null); setImagePreview(null);
  }

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    const ingredients = recipe.ingredients?.map(ing => ({
      name: ing.name || '', amount: ing.amount?.toString() || '', unit: ing.unit || 'g'
    })) || [{ name: '', amount: '', unit: 'g' }]
    setFormData({
      name: recipe.name, description: recipe.description || '', ingredients,
      instructions: recipe.instructions || [''], prep_time: recipe.prep_time,
      bake_time: recipe.bake_time, difficulty: recipe.difficulty, category: recipe.category,
      yield_amount: recipe.yield_amount, cost_per_unit: recipe.cost_per_unit || 0,
      wholesale_price: recipe.wholesale_price || 0, retail_price: recipe.retail_price || 0,
      vat_percentage: recipe.vat_percentage ?? 18,
      display_name: recipe.display_name || ''
    })
    if (recipe.image_url) setImagePreview(recipe.image_url)
    setShowAddModal(true)
  }

  const handleView = (recipe: Recipe) => {
    setSelectedRecipe(recipe); setShowViewModal(true);
  }

  const handleViewSteps = (recipe: Recipe) => {
    setSelectedRecipe(recipe); loadRecipeSteps(recipe.id); setShowStepsModal(true);
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Könnyű'
      case 'medium': return 'Közepes'
      case 'hard': return 'Nehéz'
      default: return difficulty
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recipe.description && recipe.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || recipe.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <ChefHat className="h-8 w-8 mr-3 text-amber-600" />
            Receptek
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Receptek kezelése és nyomon követése
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowExcelImporter(true)}
            className="inline-flex items-center px-4 py-2 border border-green-500 text-sm font-medium rounded-xl text-green-700 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 shadow-sm"
          >
            <FileSpreadsheet className="h-5 w-5 mr-2" />
            Excel import
          </button>
          <button 
            onClick={() => {
              resetForm()
              setEditingRecipe(null)
              setShowAddModal(true)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow-lg shadow-amber-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új recept
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keresés
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Recept neve vagy leírása..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kategória
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'Minden kategória' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Recipes Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nincsenek receptek
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Kezdje el az első recept létrehozásával.
            </p>
            <button
              onClick={() => {
                resetForm()
                setEditingRecipe(null)
                setShowAddModal(true)
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Új recept
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all duration-200"
              >
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative">
                  {recipe.image_url ? (
                    <img 
                      src={recipe.image_url} 
                      alt={recipe.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
                      {getDifficultyText(recipe.difficulty)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{recipe.name}</h3>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{recipe.prep_time + recipe.bake_time} perc</span>
                    <span className="mx-2">•</span>
                    <span>{recipe.category}</span>
                  </div>
                  {recipe.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {recipe.created_by_name ? `Létrehozta: ${recipe.created_by_name}` : ''}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleView(recipe)}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleViewSteps(recipe)}
                        className="p-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <Package className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(recipe)}
                        className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Recipe Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingRecipe ? 'Recept szerkesztése' : 'Új recept létrehozása'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Recept neve *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Display név (számlákon, szállítólevélen)
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kategória *
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      list="categories"
                      required
                    />
                    <datalist id="categories">
                      {categories.filter(c => c !== 'all').map(category => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leírás
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recept kép
                  </label>
                  <div className="flex items-center space-x-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 dark:hover:border-amber-400"
                    >
                      {imagePreview ? (
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">Kép feltöltése</span>
                        </>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </div>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null)
                          setImagePreview(null)
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                      >
                        Kép eltávolítása
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Előkészítési idő (perc) *
                    </label>
                    <input
                      type="number"
                      value={formData.prep_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, prep_time: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sütési idő (perc) *
                    </label>
                    <input
                      type="number"
                      value={formData.bake_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, bake_time: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nehézség *
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="easy">Könnyű</option>
                      <option value="medium">Közepes</option>
                      <option value="hard">Nehéz</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mennyiség (db) *
                    </label>
                    <input
                      type="number"
                      value={formData.yield_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, yield_amount: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Önköltség (Ft/db)
                    </label>
                    <input
                      type="number"
                      value={formData.cost_per_unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost_per_unit: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nagykereskedelmi ár (Ft/db)
                    </label>
                    <input
                      type="number"
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, wholesale_price: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kiskereskedelmi ár (Ft/db)
                    </label>
                    <input
                      type="number"
                      value={formData.retail_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, retail_price: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ÁFA (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={formData.vat_percentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, vat_percentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Hozzávalók *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-sm flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Hozzávaló hozzáadása
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={ingredient.name}
                          onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                          placeholder="Hozzávaló neve"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                        <input
                          type="text"
                          value={ingredient.amount}
                          onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                          placeholder="Mennyiség"
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                        <select
                          value={ingredient.unit}
                          onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="l">l</option>
                          <option value="db">db</option>
                          <option value="ek">ek</option>
                          <option value="tk">tk</option>
                          <option value="csipet">csipet</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(index)}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-300 font-medium">
                    💡 A gyártási lépéseket a recept mentése után, a <strong>„Lépések"</strong> gombbal tudod hozzáadni külön.
                  </p>
                </div>
                
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Mentés...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingRecipe ? 'Frissítés' : 'Létrehozás'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Recipe Modal */}
      {showViewModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedRecipe.name}
                </h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {selectedRecipe.image_url && (
                  <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img 
                      src={selectedRecipe.image_url} 
                      alt={selectedRecipe.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-amber-600 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      Előkészítés: {selectedRecipe.prep_time} perc
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-amber-600 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      Sütés: {selectedRecipe.bake_time} perc
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(selectedRecipe.difficulty)}`}>
                      {getDifficultyText(selectedRecipe.difficulty)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Package className="h-5 w-5 text-amber-600 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">
                      Mennyiség: {selectedRecipe.yield_amount} db
                    </span>
                  </div>
                </div>
                
                {selectedRecipe.description && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Leírás</h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedRecipe.description}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Hozzávalók</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedRecipe.ingredients?.map((ingredient, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-2 h-2 bg-amber-600 rounded-full mr-2"></div>
                        <span className="text-gray-700 dark:text-gray-300">
                          {ingredient.name}: {ingredient.amount} {ingredient.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Elkészítés</h3>
                  <div className="space-y-4">
                    {selectedRecipe.instructions?.map((instruction, index) => (
                      <div key={index} className="flex">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-800 dark:text-amber-400 font-medium mr-3">
                          {index + 1}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {instruction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {(selectedRecipe.cost_per_unit || selectedRecipe.retail_price) && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Árak</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {selectedRecipe.cost_per_unit !== null && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Önköltség</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedRecipe.cost_per_unit.toLocaleString('hu-HU')} Ft/db
                          </p>
                        </div>
                      )}
                      {selectedRecipe.wholesale_price !== null && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Nagyker ár</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedRecipe.wholesale_price.toLocaleString('hu-HU')} Ft/db
                          </p>
                        </div>
                      )}
                      {selectedRecipe.retail_price !== null && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Kisker ár</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedRecipe.retail_price.toLocaleString('hu-HU')} Ft/db
                          </p>
                        </div>
                      )}
                      {selectedRecipe.vat_percentage !== null && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">ÁFA</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedRecipe.vat_percentage.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View/Add Recipe Steps Modal (Package Icon) */}
      {showStepsModal && selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedRecipe.name} - Gyártási technológia
                  </h2>
                  <p className="text-sm text-gray-500">Kezelje a gyártási fázisokat és paramétereket</p>
                </div>
                <button
                  onClick={() => { setShowStepsModal(false); setShowAddStepForm(false); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2"
                >
                  <X className="h-7 w-7" />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="animate-spin h-8 w-8 text-amber-600" />
                </div>
              ) : (
                <div className="space-y-6">
                  {recipeSteps.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nincsenek gyártási lépések</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-6">Kezdje el a gyártási folyamat felépítését.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recipeSteps.map((step, index) => (
                        <div key={step.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center mr-4 font-bold text-lg shadow-sm">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{step.title}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm text-gray-500 flex items-center gap-1"><Clock size={14}/> {step.duration_minutes} perc</span>
                                  {step.temperature && <span className="text-sm text-gray-500 flex items-center gap-1"><Thermometer size={14}/> {step.temperature}°C</span>}
                                  {step.humidity && <span className="text-sm text-gray-500 flex items-center gap-1"><Droplets size={14}/> {step.humidity}%</span>}
                                  {step.type && (
                                    <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                      {step.type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditStep(step)} className="text-gray-400 hover:text-amber-400 p-2 transition-colors"><Edit size={18} /></button>
                              <button onClick={() => handleDeleteStep(step.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors"><Trash2 size={20} /></button>
                            </div>
                          </div>
                          <div className="p-4">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!showAddStepForm ? (
                    <button 
                      onClick={openAddStep}
                      className="w-full py-4 border-2 border-dashed border-amber-500/30 rounded-2xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={20} /> Új technológiai lépés hozzáadása
                    </button>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl border border-amber-500/50">
                      <h4 className="text-lg font-bold text-white mb-4">
                        {editingStep ? '✏️ Lépés szerkesztése' : '➕ Új lépés felvétele'}
                      </h4>
                      <form onSubmit={handleAddStep} className="space-y-4">
                        {/* Lépés típusa */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Lépés típusa</label>
                          <select
                            value={newStep.type}
                            onChange={e => setNewStep({...newStep, type: e.target.value as StepType})}
                            className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white"
                          >
                            {(Object.entries(STEP_TYPE_LABELS) as [StepType, string][]).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <input required placeholder="Lépés címe (pl: Dagasztás 160kg-os adagban)" value={newStep.title} onChange={e => setNewStep({...newStep, title: e.target.value})} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" />
                        <textarea required placeholder="Technológiai leírás (utasítások, paraméterek...)" value={newStep.description} onChange={e => setNewStep({...newStep, description: e.target.value})} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" rows={2} />
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Időtartam (perc)</label>
                            <input type="number" required value={newStep.duration_minutes} onChange={e => setNewStep({...newStep, duration_minutes: parseInt(e.target.value)})} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Hőmérséklet (°C)</label>
                            <input type="number" value={newStep.temperature} onChange={e => setNewStep({...newStep, temperature: e.target.value})} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" placeholder="Opcionális" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Páratartalom (%)</label>
                            <input type="number" value={newStep.humidity} onChange={e => setNewStep({...newStep, humidity: e.target.value})} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" placeholder="Opcionális" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => { setShowAddStepForm(false); setEditingStep(null); }} className="flex-1 py-3 text-gray-500 font-bold">Mégse</button>
                          <button type="submit" className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20">
                            <Save size={18} /> {editingStep ? 'Frissítés' : 'Lépés mentése'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Excel Recipe Importer Modal */}
      {showExcelImporter && (
        <RecipeExcelImporter
          onImportComplete={() => {
            setShowExcelImporter(false)
            loadRecipes()
          }}
          onCancel={() => setShowExcelImporter(false)}
        />
      )}

    </div>
  )
}