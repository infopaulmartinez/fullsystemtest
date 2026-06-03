import React, { useState, useEffect, useRef } from 'react'
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  CreditCard, 
  DollarSign,
  Receipt,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Printer,
  Calculator,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Edit,
  Save,
  Camera,
  Scan,
  FileText,
  TrendingUp,
  MapPin,
  RefreshCw,
  Download,
  Upload,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Filter,
  Calendar,
  Banknote,
  Coins,
  PiggyBank,
  ChefHat
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../contexts/RoleContext'
import { toast } from 'react-hot-toast'
import BarcodeScanner from '../components/Inventory/BarcodeScanner'
import { ReturnModule } from '../components/ReturnModule'
import usePersistentState from '../hooks/usePersistentState';
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// ... (Interface-ek változatlanok) ...
interface CartItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  category: string
  vat_percentage?: number
  barcode?: string
  qr_code?: string
  image_url?: string
  current_stock: number
  unit: string
}

interface POSSession {
  id: string
  location_id: string
  cashier_id: string
  terminal_id: string
  opening_amount: number
  closing_amount?: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at?: string
  total_sales: number
  cash_sales: number
  card_sales: number
  session_number: string
  terminal_name?: string
  is_active: boolean
}

interface Product {
  id: string
  name: string
  category: string
  retail_price: number
  vat_percentage: number
  image_url?: string
  description?: string
  ingredients?: any[]
  instructions?: string[]
  prep_time: number
  bake_time: number
  difficulty: string
  yield_amount: number
  barcode?: string
  qr_code?: string
  created_at: string
  updated_at: string
}

interface StoreInventoryItem {
  id: string
  product_id: string
  location_id: string
  current_stock: number
  min_threshold: number
  max_threshold?: number
  last_restock_date?: string
  unit: string
  supplier?: string
  created_at: string
  updated_at: string
}

interface ProductWithInventory extends Product {
  inventory: StoreInventoryItem[]
  current_stock: number
  unit: string
}

interface CashMovement {
  id: string
  session_id: string
  type: 'opening' | 'closing' | 'deposit' | 'withdrawal' | 'adjustment'
  amount: number
  reason?: string
  receipt_photo?: string
  notes?: string
  created_at: string
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  items: any[]
  total_amount: number
  status: string
  delivery_date?: string
  created_at: string
  delivery_note_generated?: boolean
}

interface ReturnItem {
  id: string
  product_id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  reason?: string
  condition?: string
}


export default function POS() {
  const { user } = useAuth()
  const { role } = useRole()
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'orders' | 'returns' | 'cash' | 'reports'>('pos')
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState(0)
  
  // Session State - JAVÍTVA
  const [currentSession, setCurrentSession] = usePersistentState<POSSession | null>('pos_session', null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [selectedLocation, setSelectedLocation] = usePersistentState<string>('pos_location', '');
  const [terminalName, setTerminalName] = usePersistentState<string>('pos_terminal_name', '');
  
  // Data State
  const [products, setProducts] = useState<ProductWithInventory[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Inventory State
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithInventory | null>(null)
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    retail_price: 0,
    vat_percentage: 18,
    description: '',
    prep_time: 0,
    bake_time: 0,
    difficulty: 'medium',
    yield_amount: 1,
    barcode: '',
    qr_code: '',
    current_stock: 0,
    min_threshold: 5,
    unit: 'db',
    supplier: ''
  })
  
  // Orders State
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [orderCustomer, setOrderCustomer] = useState('')
  
  // Returns State
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [returnReason, setReturnReason] = useState('')
  const [originalTransaction, setOriginalTransaction] = useState('')
  
  // Cash Management State
  const [showCashModal, setShowCashModal] = useState(false)
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const [cashOperation, setCashOperation] = useState<'deposit' | 'withdrawal'>('deposit')
  const [cashAmount, setCashAmount] = useState(0)
  const [cashReason, setCashReason] = useState('')
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)
  
  // Scanner State
  const [showScanner, setShowScanner] = useState(false)
  const [scannerMode, setScannerMode] = useState<'add-to-cart' | 'inventory-search'>('add-to-cart')
  
  // Reports State
  const [reportData, setReportData] = useState({
    todaySales: 0,
    todayTransactions: 0,
    topProducts: [],
    lowStockItems: [],
    cashFlow: []
  })

useEffect(() => {
  // Mindent betöltünk egyszerre – selectedLocation-tól függetlenül
  // Így nem blokkolódik a belépés ha nincs location beállítva
  setLoading(true)
  Promise.all([
    loadLocations(),
    loadProducts(),
    loadOrders(),
    loadReportData(),
    checkActiveSession(),
  ]).finally(() => setLoading(false))
}, [user])

useEffect(() => {
  if (currentSession) {
    loadSessionData();
  }
}, [currentSession]);

const [showReceiptModal, setShowReceiptModal] = useState(false);
const [currentReceiptData, setCurrentReceiptData] = useState<any>(null); // EZ A SOR!

  const loadLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      const loadedLocations = data || [];
      setLocations(loadedLocations);

      if (loadedLocations.length > 0 && !selectedLocation) {
        setSelectedLocation(loadedLocations[0].id);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    // locationId nélkül is betöltjük a termékeket – ne blokkoljon
    const locationId = currentSession?.location_id || selectedLocation || null;

    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products').select('*').order('name');
      if (productsError) throw productsError;

      const { data: inventoryData, error: inventoryError } = locationId
        ? await supabase.from('store_inventory').select('*').eq('location_id', locationId)
        : { data: [], error: null };
      if (inventoryError && inventoryError.code !== 'PGRST116') throw inventoryError;

      const productsWithInventory: ProductWithInventory[] = (productsData || []).map(product => {
        const inventory = (inventoryData || []).filter(inv => inv.product_id === product.id);
        const totalStock = inventory.reduce((sum, inv) => sum + inv.current_stock, 0);
        const firstInventory = inventory[0];
        return { ...product, inventory, current_stock: totalStock, unit: firstInventory?.unit || 'db' };
      });

      setProducts(productsWithInventory);
      const uniqueCategories = [...new Set(productsWithInventory.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Hiba a termékek betöltésekor');
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_daily_orders', { p_date: selectedDate });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Hiba a rendelések betöltésekor');
    }
  };

  const loadSessionData = async () => {
    if (!currentSession) return;
    try {
      const { data: movements, error: movementsError } = await supabase
        .from('cash_movements').select('*').eq('session_id', currentSession.id).order('created_at', { ascending: false });
      if (movementsError) throw movementsError;
      setCashMovements(movements || []);
    } catch (error) {
      console.error('Error loading session data:', error);
    }
  };

  const loadReportData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: salesData, error: salesError } = await supabase
        .from('pos_transactions').select('total_amount').gte('created_at', today).eq('status', 'completed');
      if (salesError) throw salesError;

      const todaySales = salesData?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
      const todayTransactions = salesData?.length || 0;
      const lowStockItems = products.filter(product => product.current_stock <= (product.inventory[0]?.min_threshold || 5));

      setReportData({ todaySales, todayTransactions, topProducts: [], lowStockItems, cashFlow: [] });
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Hiba a riportadatok betöltésekor');
    }
  };

const checkActiveSession = async () => {
  if (!user) return;
  try {
    const { data: sessionData, error } = await supabase
      .from('pos_sessions').select('*, locations(name)')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle();
      
    if (error) throw error;
    
    if (sessionData) {
      setCurrentSession(sessionData);
      if (!selectedLocation && sessionData.location_id) {
        setSelectedLocation(sessionData.location_id);
      }
      if (!terminalName && sessionData.terminal_name) {
        setTerminalName(sessionData.terminal_name);
      }
      setShowSessionModal(false);
    } else {
      // Nincs aktív session – de NEM blokkoljuk a belépést.
      // Admin szabadon böngészhet, és manuálisan nyithat kasszát.
      setCurrentSession(null);
      setShowSessionModal(false);
    }
  } catch (error) {
    console.error('Error checking active session:', error);
    setCurrentSession(null);
  }
};
  
  const openSession = async () => {
    try {
      // Ha nincs terminalName, auto-kitöltjük; ha nincs location, null-lal mentjük
      const effectiveTerminal = terminalName || 'Főpénztár'
      const effectiveLocation = selectedLocation || (locations[0]?.id ?? null)
      if (!terminalName) setTerminalName(effectiveTerminal)
      const { data, error } = await supabase
        .from('pos_sessions').insert([{
          location_id: effectiveLocation, cashier_id: user?.id, terminal_name: effectiveTerminal, opening_amount: openingAmount, status: 'open', is_active: true
        }]).select().single();
      if (error) throw error;
      
      await supabase.from('cash_movements').insert([{
        session_id: data.id, location_id: selectedLocation, cashier_id: user?.id, type: 'opening', amount: openingAmount, reason: 'Kassza nyitás', notes: `Terminál: ${terminalName}`
      }]);
      
      setCurrentSession(data);
      setShowSessionModal(false);
      generateSessionReceipt(data, 'opening');
      toast.success('Kassza sikeresen megnyitva!');
    } catch (error) {
      console.error('Error opening session:', error);
      toast.error('Hiba a kassza nyitásakor');
    }
  };

  const closeSession = async () => {
    if (!currentSession) return;
    try {
      const { error } = await supabase.from('pos_sessions').update({ 
        status: 'closed', closed_at: new Date().toISOString(), closing_amount: closingAmount, is_active: false 
      }).eq('id', currentSession.id);
      if (error) throw error;
      
      await supabase.from('cash_movements').insert([{
        session_id: currentSession.id, location_id: currentSession.location_id, cashier_id: user?.id, type: 'closing', amount: closingAmount, reason: 'Kassza zárás', notes: `Terminál: ${currentSession.terminal_name}`
      }]);
      
      generateSessionReceipt({ ...currentSession, closing_amount: closingAmount }, 'closing');
      toast.success('Kassza sikeresen lezárva!');
      
      setCurrentSession(null);
      setShowSessionModal(false); // Modal ZÁRVA marad – admin szabadon visszaléphet
    } catch (error) {
      console.error('Error closing session:', error);
      toast.error('Hiba a kassza záráskor');
    }
  };

  const generateSessionReceipt = (session: POSSession, type: 'opening' | 'closing') => {
    const doc = new jsPDF({
      format: [80, 200],
      unit: 'mm'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Szemesi Pékség', pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Balatonföldvár Üzlet', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('Adószám: 12345678-1-42', pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const receiptTitle = type === 'opening' ? 'KASSZA NYITÁS' : 'KASSZA ZÁRÁS'
    doc.text(receiptTitle, pageWidth / 2, yPos, { align: 'center' })
    yPos += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Munkamenet: ${session.session_number}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text(`${new Date().toLocaleString('hu-HU')}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    doc.text(`Terminál: ${session.terminal_name}`, 5, yPos)
    yPos += 4
    doc.text(`Pénztáros: ${user?.user_metadata?.full_name || user?.email}`, 5, yPos)
    yPos += 6

    if (type === 'opening') {
      doc.text(`Nyitó összeg: ${session.opening_amount.toLocaleString('hu-HU')} Ft`, 5, yPos)
    } else {
      doc.text(`Nyitó összeg: ${session.opening_amount.toLocaleString('hu-HU')} Ft`, 5, yPos)
      yPos += 4
      doc.text(`Záró összeg: ${session.closing_amount?.toLocaleString('hu-HU')} Ft`, 5, yPos)
      yPos += 4
      doc.text(`Napi forgalom: ${session.total_sales.toLocaleString('hu-HU')} Ft`, 5, yPos)
      yPos += 4
      const difference = (session.closing_amount || 0) - session.opening_amount - session.total_sales
      doc.text(`Különbözet: ${difference.toLocaleString('hu-HU')} Ft`, 5, yPos)
    }
    yPos += 8

    doc.text('Köszönjük a vásárlást!', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('www.szemesipekseg.hu', pageWidth / 2, yPos, { align: 'center' })

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  const addToCart = (product: ProductWithInventory) => {
    if (product.current_stock <= 0) {
      toast.error('A termék nincs készleten')
      return
    }

    const existingItem = cart.find(item => item.product_id === product.id)
    
    if (existingItem) {
      if (existingItem.quantity >= product.current_stock) {
        toast.error('Nincs elegendő készlet')
        return
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        id: Date.now().toString(),
        product_id: product.id,
        name: product.name,
        price: product.retail_price || 0,
        quantity: 1,
        category: product.category,
        vat_percentage: product.vat_percentage,
        barcode: product.barcode,
        qr_code: product.qr_code,
        image_url: product.image_url,
        current_stock: product.current_stock,
        unit: product.unit
      }])
    }
  }

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId)
      return
    }

    const cartItem = cart.find(item => item.id === itemId)
    if (cartItem && newQuantity > cartItem.current_stock) {
      toast.error('Nincs elegendő készlet')
      return
    }

    setCart(cart.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const discountAmount = subtotal * (discount / 100)
    return subtotal - discountAmount
  }

  const calculateTax = () => {
    return cart.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity
      const vatRate = (item.vat_percentage || 18) / 100
      return sum + (itemTotal * vatRate / (1 + vatRate))
    }, 0)
  }

const processPayment = async () => {
  if (!currentSession) {
    toast.error('Nincs aktív munkamenet');
    return;
  }
  if (cart.length === 0) {
    toast.error('A kosár üres');
    return;
  }

  try {
    const total = calculateTotal();
    const tax = calculateTax();

    const transactionData = {
      session_id: currentSession.id,
      location_id: currentSession.location_id,
      cashier_id: user?.id,
      customer_name: customerName || null,
      subtotal: total - tax,
      tax_amount: tax,
      total_amount: total,
      payment_method: paymentMethod,
      discount_amount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (discount / 100),
      status: 'completed'
    };

    const { data: transaction, error: transactionError } = await supabase
      .from('pos_transactions')
      .insert([transactionData])
      .select()
      .single();
    if (transactionError) throw transactionError;

    const transactionItems = cart.map(item => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      discount_amount: 0
    }));

    const { error: itemsError } = await supabase.from('pos_transaction_items').insert(transactionItems);
    if (itemsError) throw itemsError;

    // --- JAVÍTVA: Készlet csökkentése RPC-vel ---
    const decrementPromises = cart.map(item =>
      supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_location_id: currentSession.location_id,
        p_quantity: item.quantity
      })
    );
    await Promise.all(decrementPromises);
    // --- JAVÍTÁS VÉGE ---

    const updatedSession = {
      ...currentSession,
      total_sales: currentSession.total_sales + total,
      cash_sales: paymentMethod === 'cash' ? currentSession.cash_sales + total : currentSession.cash_sales,
      card_sales: paymentMethod === 'card' ? currentSession.card_sales + total : currentSession.card_sales
    };

    await supabase.from('pos_sessions').update(updatedSession).eq('id', currentSession.id);
    setCurrentSession(updatedSession);

    generateReceipt(transaction, cart);
    setCart([]);
    setCustomerName('');
    setDiscount(0);

    toast.success('Fizetés sikeresen feldolgozva!');
    loadProducts();

  } catch (error: any) {
    console.error('Error processing payment:', error);
    toast.error(`Hiba a fizetés feldolgozásakor: ${error.message}`);
  }
};

  const generateReceipt = (transaction: any, items: CartItem[]) => {
    const doc = new jsPDF({
      format: [80, 200],
      unit: 'mm'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Szemesi Pékség', pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Balatonföldvár Üzlet', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('Adószám: 12345678-1-42', pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('NYUGTA', pageWidth / 2, yPos, { align: 'center' })
    yPos += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`${transaction.transaction_number}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text(`${new Date().toLocaleString('hu-HU')}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    doc.text('Termék', 5, yPos)
    doc.text('Összeg', pageWidth - 5, yPos, { align: 'right' })
    yPos += 4

    doc.text('─'.repeat(35), 5, yPos)
    yPos += 4

    items.forEach(item => {
      const itemText = `${item.name} x${item.quantity}`
      const priceText = `${(item.price * item.quantity).toLocaleString('hu-HU')} Ft`
      
      doc.text(itemText, 5, yPos)
      doc.text(priceText, pageWidth - 5, yPos, { align: 'right' })
      yPos += 4
      
      if (item.quantity > 1) {
        doc.text(`  ${item.price.toLocaleString('hu-HU')} Ft/db`, 5, yPos)
        yPos += 3
      }
    })

    yPos += 2
    doc.text('─'.repeat(35), 5, yPos)
    yPos += 4

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const discountAmount = subtotal * (discount / 100)
    const total = subtotal - discountAmount

    if (discountAmount > 0) {
      doc.text('Részösszeg:', 5, yPos)
      doc.text(`${subtotal.toLocaleString('hu-HU')} Ft`, pageWidth - 5, yPos, { align: 'right' })
      yPos += 4
      
      doc.text(`Kedvezmény (${discount}%):`, 5, yPos)
      doc.text(`-${discountAmount.toLocaleString('hu-HU')} Ft`, pageWidth - 5, yPos, { align: 'right' })
      yPos += 4
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Végösszeg:', 5, yPos)
    doc.text(`${total.toLocaleString('hu-HU')} Ft`, pageWidth - 5, yPos, { align: 'right' })
    yPos += 6

    doc.setFont('helvetica', 'normal')
    doc.text(`Fizetés módja: ${paymentMethod === 'cash' ? 'Készpénz' : paymentMethod === 'card' ? 'Kártya' : 'Átutalás'}`, 5, yPos)
    yPos += 4
    doc.text(`Pénztáros: ${user?.user_metadata?.full_name || user?.email}`, 5, yPos)
    yPos += 8

    doc.text('Köszönjük a vásárlást!', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('www.szemesipekseg.hu', pageWidth / 2, yPos, { align: 'center' })

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  const handleScan = (data: string, type: 'barcode' | 'qrcode') => {
    if (scannerMode === 'add-to-cart') {
      const product = products.find(p => 
        type === 'barcode' ? p.barcode === data : p.qr_code === data
      )
      
      if (product) {
        addToCart(product)
        toast.success(`${product.name} hozzáadva a kosárhoz`)
      } else {
        toast.error('Termék nem található')
      }
    } else if (scannerMode === 'inventory-search') {
      setSearchTerm(data)
    }
    
    setShowScanner(false)
  }

  const addProduct = async () => {
    try {
      if (!newProduct.name || !newProduct.retail_price) {
        toast.error('Név és ár megadása kötelező')
        return
      }

      // Új termék hozzáadása a products táblához
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert([{
          name: newProduct.name,
          category: newProduct.category,
          retail_price: newProduct.retail_price,
          vat_percentage: newProduct.vat_percentage,
          description: newProduct.description,
          prep_time: newProduct.prep_time,
          bake_time: newProduct.bake_time,
          difficulty: newProduct.difficulty,
          yield_amount: newProduct.yield_amount,
          barcode: newProduct.barcode,
          qr_code: newProduct.qr_code,
          created_by: user?.id
        }])
        .select()
        .single()

      if (productError) throw productError

      // Készlet bejegyzés hozzáadása a store_inventory táblához
      const { error: inventoryError } = await supabase
        .from('store_inventory')
        .insert([{
          product_id: productData.id,
          location_id: currentSession?.location_id,
          current_stock: newProduct.current_stock,
          min_threshold: newProduct.min_threshold,
          unit: newProduct.unit,
          supplier: newProduct.supplier
        }])

      if (inventoryError) throw inventoryError

      toast.success('Termék sikeresen hozzáadva!')
      setShowAddProduct(false)
      setNewProduct({
        name: '',
        category: '',
        retail_price: 0,
        vat_percentage: 18,
        description: '',
        prep_time: 0,
        bake_time: 0,
        difficulty: 'medium',
        yield_amount: 1,
        barcode: '',
        qr_code: '',
        current_stock: 0,
        min_threshold: 5,
        unit: 'db',
        supplier: ''
      })
      loadProducts()
    } catch (error) {
      console.error('Error adding product:', error)
      toast.error('Hiba a termék hozzáadásakor')
    }
  }

  const updateProduct = async () => {
    if (!editingProduct) return

    try {
      // Termék frissítése a products táblában
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: editingProduct.name,
          category: editingProduct.category,
          retail_price: editingProduct.retail_price,
          vat_percentage: editingProduct.vat_percentage,
          description: editingProduct.description
        })
        .eq('id', editingProduct.id)

      if (productError) throw productError

      // Készlet frissítése a store_inventory táblában
      if (editingProduct.inventory && editingProduct.inventory.length > 0) {
        const { error: inventoryError } = await supabase
          .from('store_inventory')
          .update({
            current_stock: editingProduct.current_stock,
            min_threshold: editingProduct.inventory[0].min_threshold,
            unit: editingProduct.unit
          })
          .eq('product_id', editingProduct.id)
          .eq('location_id', currentSession?.location_id)

        if (inventoryError) throw inventoryError
      }

      toast.success('Termék sikeresen frissítve!')
      setEditingProduct(null)
      loadProducts()
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Hiba a termék frissítésekor')
    }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a terméket?')) return

    try {
      // Készlet törlése
      await supabase
        .from('store_inventory')
        .delete()
        .eq('product_id', productId)

      // Termék törlése
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      toast.success('Termék sikeresen törölve!')
      loadProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Hiba a termék törlésekor')
    }
  }

  const createOrder = async () => {
    try {
      if (!orderCustomer || orderItems.length === 0) {
        toast.error('Ügyfél neve és termékek megadása kötelező')
        return
      }

      const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

      const orderData = {
        customer_name: orderCustomer,
        items: orderItems,
        total_amount: total,
        status: 'pending',
        delivery_date: new Date(selectedDate + 'T08:00:00').toISOString(),
        location_id: currentSession?.location_id,
        created_by: user?.id
      }

      const { error } = await supabase
        .from('orders')
        .insert([orderData])

      if (error) throw error

      toast.success('Rendelés sikeresen létrehozva!')
      setShowOrderForm(false)
      setOrderItems([])
      setOrderCustomer('')
      loadOrders()
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Hiba a rendelés létrehozásakor')
    }
  }

const loadOrderToInventory = async (order: Order) => {
  const locationId = currentSession?.location_id;
  if (!locationId) {
    toast.error('Nincs aktív kassza vagy helyszín a készlet frissítéséhez.');
    return;
  }

  try {
    if (!order.items || order.items.length === 0) {
      toast.error('A rendelés nem tartalmaz termékeket');
      return;
    }

    // Előkészítjük az RPC hívásokat minden egyes tételhez
    const updatePromises = order.items.map(item => 
      supabase.rpc('increment_stock', {
        p_product_id: item.product_id,
        p_location_id: locationId,
        p_quantity: item.quantity
      })
    );

    // Párhuzamosan futtatjuk az összes adatbázis-műveletet
    const results = await Promise.all(updatePromises);
    
    // Ellenőrizzük, hogy volt-e hiba bármelyik hívásnál
    const firstError = results.find(res => res.error);
    if (firstError) {
      // Ha volt hiba, továbbdobjuk, hogy a catch blokk elkapja
      throw firstError.error; 
    }

    // Rendelés állapotának frissítése sikeres készletre vétel után
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ delivery_note_generated: true, status: 'completed' })
      .eq('id', order.id);

    if (orderUpdateError) throw orderUpdateError;

    toast.success('Rendelés sikeresen betöltve a készletbe!');
    loadProducts(); // Frissítjük a termék/készlet listát, hogy látszódjon a változás
    loadOrders();   // Frissítjük a rendelések listáját, hogy a gomb eltűnjön

  } catch (error) {
    console.error('Error loading order to inventory:', error);
    toast.error('Hiba a rendelés készletre vételekor.');
  }
}

  const processReturn = async () => {
    try {
      if (returnItems.length === 0) {
        toast.error('Nincs visszáru tétel')
        return
      }

      const total = returnItems.reduce((sum, item) => sum + item.total_price, 0)

      const returnData = {
        session_id: currentSession?.id,
        location_id: currentSession?.location_id,
        cashier_id: user?.id,
        original_transaction_id: originalTransaction || null,
        subtotal: total,
        total_amount: total,
        payment_method: 'cash',
        reason: returnReason,
        status: 'completed'
      }

      const { data: returnRecord, error: returnError } = await supabase
        .from('pos_returns')
        .insert([returnData])
        .select()
        .single()

      if (returnError) throw returnError

      const returnItemsData = returnItems.map(item => ({
        return_id: returnRecord.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        reason: item.reason,
        condition: item.condition
      }))

      const { error: itemsError } = await supabase
        .from('pos_return_items')
        .insert(returnItemsData)

      if (itemsError) throw itemsError

      // Készlet visszaállítása
      const locationId = currentSession?.location_id
      if (!locationId) throw new Error('Nincs aktív helyszín a visszáru készletfrissítéséhez.')

      for (const item of returnItems) {
        const { error: stockError } = await supabase.rpc('increment_stock', {
          p_product_id: item.product_id,
          p_location_id: locationId,
          p_quantity: item.quantity
        })
        if (stockError) throw stockError
      }

      generateReturnReceipt(returnRecord, returnItems)

      toast.success('Visszáru sikeresen feldolgozva!')
      setShowReturnModal(false)
      setReturnItems([])
      setReturnReason('')
      setOriginalTransaction('')
      
      loadProducts()
    } catch (error) {
      console.error('Error processing return:', error)
      toast.error('Hiba a visszáru feldolgozásakor')
    }
  }

  const generateReturnReceipt = (returnRecord: any, items: ReturnItem[]) => {
    const doc = new jsPDF({
      format: [80, 200],
      unit: 'mm'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Szemesi Pékség', pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Balatonföldvár Üzlet', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('Adószám: 12345678-1-42', pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('VISSZÁRU BIZONYLAT', pageWidth / 2, yPos, { align: 'center' })
    yPos += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`${returnRecord.return_number}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text(`${new Date().toLocaleString('hu-HU')}`, pageWidth / 2, yPos, { align: 'center' })
    
    if (originalTransaction) {
      yPos += 3
      doc.text(`Eredeti tranzakció: ${originalTransaction}`, pageWidth / 2, yPos, { align: 'center' })
    }
    yPos += 8

    doc.text('Termék', 5, yPos)
    doc.text('Összeg', pageWidth - 5, yPos, { align: 'right' })
    yPos += 4

    doc.text('─'.repeat(35), 5, yPos)
    yPos += 4

    items.forEach(item => {
      const itemText = `${item.name} x${item.quantity}`
      const priceText = `${item.total_price.toLocaleString('hu-HU')} Ft`
      
      doc.text(itemText, 5, yPos)
      doc.text(priceText, pageWidth - 5, yPos, { align: 'right' })
      yPos += 4
      
      if (item.reason) {
        doc.text(`  Indok: ${item.reason}`, 5, yPos)
        yPos += 3
      }
    })

    yPos += 2
    doc.text('─'.repeat(35), 5, yPos)
    yPos += 4

    const total = items.reduce((sum, item) => sum + item.total_price, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('Visszatérítés összesen:', 5, yPos)
    doc.text(`${total.toLocaleString('hu-HU')} Ft`, pageWidth - 5, yPos, { align: 'right' })
    yPos += 6

    doc.setFont('helvetica', 'normal')
    doc.text(`Visszatérítés módja: Készpénz`, 5, yPos)
    yPos += 4
    doc.text(`Pénztáros: ${user?.user_metadata?.full_name || user?.email}`, 5, yPos)
    yPos += 8

    doc.text('Köszönjük a vásárlást!', pageWidth / 2, yPos, { align: 'center' })
    yPos += 3
    doc.text('www.szemesipekseg.hu', pageWidth / 2, yPos, { align: 'center' })

    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  const recordCashMovement = async () => {
    try {
      if (!currentSession) {
        toast.error('Nincs aktív munkamenet')
        return
      }

      if (cashAmount <= 0) {
        toast.error('Az összeg nem lehet nulla vagy negatív')
        return
      }

      let receiptPhotoUrl = null
      if (receiptPhoto) {
        const fileName = `receipt-${Date.now()}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptPhoto)

        if (uploadError) throw uploadError
        receiptPhotoUrl = uploadData.path
      }

      const movementData = {
        session_id: currentSession.id,
        location_id: currentSession.location_id,
        cashier_id: user?.id,
        type: cashOperation,
        amount: cashOperation === 'withdrawal' ? -cashAmount : cashAmount,
        reason: cashReason,
        receipt_photo: receiptPhotoUrl,
        notes: `${cashOperation === 'deposit' ? 'Betét' : 'Kivétel'}: ${cashReason}`
      }

      const { error } = await supabase
        .from('cash_movements')
        .insert([movementData])

      if (error) throw error

      toast.success('Pénzmozgás sikeresen rögzítve!')
      setShowCashModal(false)
      setCashAmount(0)
      setCashReason('')
      setReceiptPhoto(null)
      loadSessionData()
    } catch (error) {
      console.error('Error recording cash movement:', error)
      toast.error('Hiba a pénzmozgás rögzítésekor')
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.includes(searchTerm) ||
                         product.qr_code?.includes(searchTerm)
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">POS Terminál</h1>
            {currentSession && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentSession.terminal_name} - {currentSession.session_number}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {!currentSession ? (
              <button
                onClick={() => setShowSessionModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Kassza nyitás
              </button>
            ) : (
              <button
                onClick={() => setClosingAmount(0) || setShowSessionModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2 inline" />
                Kassza zárás
              </button>
            )}
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'pos', label: 'Értékesítés', icon: ShoppingCart },
            { id: 'inventory', label: 'Készlet', icon: Package },
            { id: 'orders', label: 'Rendelések', icon: FileText },
            { id: 'returns', label: 'Visszáru', icon: ArrowLeft },
            { id: 'cash', label: 'Pénzkezelés', icon: DollarSign },
            { id: 'reports', label: 'Jelentések', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pos' && (
          <div className="h-full flex">
            {/* Product List */}
            <div className="flex-1 p-4 overflow-y-auto">
              {/* Search and Filters */}
              <div className="flex space-x-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Keresés termék neve, vonalkód vagy QR kód alapján..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={() => {
                    setScannerMode('add-to-cart')
                    setShowScanner(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Scan className="h-4 w-4 mr-2 inline" />
                  Szkennelés
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex space-x-2 mb-4 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Összes
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                      product.current_stock <= 0
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 opacity-50'
                        : product.current_stock <= (product.inventory[0]?.min_threshold || 5)
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ChefHat className="h-8 w-8 text-white" />
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                        {product.name}
                      </h3>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {(product.retail_price || 0).toLocaleString('hu-HU')} Ft
                      </p>
                      <p className={`text-xs ${
                        product.current_stock <= 0
                          ? 'text-red-600 dark:text-red-400'
                          : product.current_stock <= (product.inventory[0]?.min_threshold || 5)
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {product.current_stock} {product.unit} készleten
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Kosár ({cart.length})
              </h2>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto mb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">A kosár üres</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            {item.image_url && (
                              <img 
                                src={item.image_url} 
                                alt={item.name} 
                                className="w-8 h-8 rounded object-cover mr-2"
                              />
                            )}
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                              {item.name}
                            </h4>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {(item.price * item.quantity).toLocaleString('hu-HU')} Ft
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer and Discount */}
              {cart.length > 0 && (
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="Vevő neve (opcionális)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Kedvezmény %"
                      value={discount || ''}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="cash">Készpénz</option>
                      <option value="card">Kártya</option>
                      <option value="transfer">Átutalás</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Total and Payment */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Részösszeg (bruttó):</span>
                      <span>{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('hu-HU')} Ft</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Kedvezmény ({discount}%):</span>
                        <span>-{(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (discount / 100)).toLocaleString('hu-HU')} Ft</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>ÁFA:</span>
                      <span>{calculateTax().toLocaleString('hu-HU')} Ft</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Végösszeg (bruttó):</span>
                      <span>{calculateTotal().toLocaleString('hu-HU')} Ft</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={processPayment}
                    disabled={!currentSession}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <Receipt className="h-5 w-5 mr-2" />
                    Fizetés
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* További tab-ok (inventory, orders, returns, cash, reports) itt maradnak ugyanazok */}
        {activeTab === 'inventory' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Készletkezelés</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setScannerMode('inventory-search')
                    setShowScanner(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Scan className="h-4 w-4 mr-2 inline" />
                  Keresés szkennelés
                </button>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2 inline" />
                  Termék hozzáadása
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Keresés..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Termék
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Készlet
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ár
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Kategória
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Műveletek
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mr-3 overflow-hidden">
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ChefHat className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {product.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${
                            product.current_stock <= 0
                              ? 'text-red-600 dark:text-red-400'
                              : product.current_stock <= (product.inventory[0]?.min_threshold || 5)
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {product.current_stock} {product.unit}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Min: {product.inventory[0]?.min_threshold || 5}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(product.retail_price || 0).toLocaleString('hu-HU')} Ft
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* A többi tab marad ugyanaz */}
        {activeTab === 'orders' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Rendelések</h2>
              <div className="flex items-center space-x-4">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => setShowOrderForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2 inline" />
                  Új rendelés
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Nincsenek rendelések erre a napra</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map(order => (
                    <div key={order.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {order.order_number}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {order.customer_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {order.items?.length || 0} termék • {order.total_amount.toLocaleString('hu-HU')} Ft
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                            order.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {order.status === 'completed' ? 'Teljesítve' :
                             order.status === 'pending' ? 'Függőben' : order.status}
                          </span>
                          {!order.delivery_note_generated && (
                            <button
                              onClick={() => loadOrderToInventory(order)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                            >
                              <Upload className="h-3 w-3 mr-1 inline" />
                              Készletre
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="p-4">
            <ReturnModule />
          </div>
        )}

        {activeTab === 'cash' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pénzkezelés</h2>
              <button
                onClick={() => setShowCashModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <DollarSign className="h-4 w-4 mr-2 inline" />
                Pénzmozgás rögzítése
              </button>
            </div>

            {/* Cash Movements */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">Pénzmozgások</h3>
              </div>
              
              {cashMovements.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Nincsenek pénzmozgások</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cashMovements.map(movement => (
                    <div key={movement.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              movement.type === 'deposit' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                              movement.type === 'withdrawal' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}>
                              {movement.type === 'deposit' ? 'Betét' :
                               movement.type === 'withdrawal' ? 'Kivétel' :
                               movement.type === 'opening' ? 'Nyitás' :
                               movement.type === 'closing' ? 'Zárás' : movement.type}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(movement.created_at).toLocaleString('hu-HU')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {movement.reason}
                          </p>
                          {movement.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {movement.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-semibold ${
                            movement.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {movement.amount > 0 ? '+' : ''}{movement.amount.toLocaleString('hu-HU')} Ft
                          </span>
                          {movement.receipt_photo && (
                            <div className="mt-1">
                              <button className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                <Camera className="h-3 w-3 mr-1 inline" />
                                Bizonylat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Jelentések</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-3">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mai forgalom</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {reportData.todaySales.toLocaleString('hu-HU')} Ft
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-3">
                    <ShoppingCart className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tranzakciók</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {reportData.todayTransactions}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-3">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Alacsony készlet</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {reportData.lowStockItems.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Low Stock Items */}
            {reportData.lowStockItems.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white">Alacsony készletű termékek</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportData.lowStockItems.map((item: any) => (
                      <div key={item.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Készlet: {item.current_stock} {item.unit} (Min: {item.inventory[0]?.min_threshold || 5})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {currentSession ? 'Kassza zárás' : 'Kassza nyitás'}
              </h3>
              
              {!currentSession ? (
                <div className="space-y-4">
                  {/* Opcionális: nyitó összeg – kitöltése nem kötelező */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nyitó összeg (Ft) – opcionális
                    </label>
                    <input
                      type="number"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>

                  {/* Helyszín és terminál – mindig mutatjuk ha van legalább 1 */}
                  {locations.length >= 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Helyszín
                      </label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Automatikus</option>
                        {locations.map(location => (
                          <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowSessionModal(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Mégse
                    </button>
                    <button
                      onClick={openSession}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-base"
                    >
                      ✅ OK
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Nyitó összeg:</span>
                        <div className="font-medium">{currentSession.opening_amount.toLocaleString('hu-HU')} Ft</div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Mai forgalom:</span>
                        <div className="font-medium">{currentSession.total_sales.toLocaleString('hu-HU')} Ft</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Záró összeg (Ft) *
                    </label>
                    <input
                      type="number"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span>Várható összeg:</span>
                        <span className="font-medium">
                          {(currentSession.opening_amount + currentSession.total_sales).toLocaleString('hu-HU')} Ft
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Különbözet:</span>
                        <span className={`font-medium ${
                          closingAmount - currentSession.opening_amount - currentSession.total_sales === 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {(closingAmount - currentSession.opening_amount - currentSession.total_sales).toLocaleString('hu-HU')} Ft
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => setShowSessionModal(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Mégse
                    </button>
                    <button
                      onClick={closeSession}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Kassza zárás
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Új termék hozzáadása
                </h3>
                <button
                  onClick={() => setShowAddProduct(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Termék neve *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategória *
                  </label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kiskereskedelmi ár (Ft) *
                  </label>
                  <input
                    type="number"
                    value={newProduct.retail_price}
                    onChange={(e) => setNewProduct({...newProduct, retail_price: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ÁFA % *
                  </label>
                  <select
                    value={newProduct.vat_percentage}
                    onChange={(e) => setNewProduct({...newProduct, vat_percentage: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={5}>5%</option>
                    <option value={18}>18%</option>
                    <option value={27}>27%</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Jelenlegi készlet
                  </label>
                  <input
                    type="number"
                    value={newProduct.current_stock}
                    onChange={(e) => setNewProduct({...newProduct, current_stock: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Egység
                  </label>
                  <select
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="db">db</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Min. készlet
                  </label>
                  <input
                    type="number"
                    value={newProduct.min_threshold}
                    onChange={(e) => setNewProduct({...newProduct, min_threshold: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Szállító
                  </label>
                  <input
                    type="text"
                    value={newProduct.supplier}
                    onChange={(e) => setNewProduct({...newProduct, supplier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowAddProduct(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={addProduct}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  Mentés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Termék szerkesztése
                </h3>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Termék neve *
                  </label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategória *
                  </label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kiskereskedelmi ár (Ft) *
                  </label>
                  <input
                    type="number"
                    value={editingProduct.retail_price}
                    onChange={(e) => setEditingProduct({...editingProduct, retail_price: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ÁFA % *
                  </label>
                  <select
                    value={editingProduct.vat_percentage}
                    onChange={(e) => setEditingProduct({...editingProduct, vat_percentage: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={5}>5%</option>
                    <option value={18}>18%</option>
                    <option value={27}>27%</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Jelenlegi készlet
                  </label>
                  <input
                    type="number"
                    value={editingProduct.current_stock}
                    onChange={(e) => setEditingProduct({...editingProduct, current_stock: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Egység
                  </label>
                  <select
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({...editingProduct, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="db">db</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Min. készlet
                  </label>
                  <input
                    type="number"
                    value={editingProduct.inventory[0]?.min_threshold || 5}
                    onChange={(e) => {
                      const updatedInventory = [...editingProduct.inventory]
                      if (updatedInventory[0]) {
                        updatedInventory[0].min_threshold = Number(e.target.value)
                      }
                      setEditingProduct({...editingProduct, inventory: updatedInventory})
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={updateProduct}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  Frissítés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Form Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Új rendelés létrehozása
                </h3>
                <button
                  onClick={() => setShowOrderForm(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Details */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ügyfél neve *
                    </label>
                    <input
                      type="text"
                      value={orderCustomer}
                      onChange={(e) => setOrderCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Szállítási dátum
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  {/* Product Selection */}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Termékek hozzáadása</h4>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      {products.map(product => (
                        <div
                          key={product.id}
                          onClick={() => {
                            const existingItem = orderItems.find(item => item.product_id === product.id)
                            if (existingItem) {
                              setOrderItems(orderItems.map(item =>
                                item.product_id === product.id
                                  ? { ...item, quantity: item.quantity + 1 }
                                  : item
                              ))
                            } else {
                              setOrderItems([...orderItems, {
                                product_id: product.id,
                                name: product.name,
                                price: product.retail_price,
                                quantity: 1
                              }])
                            }
                          }}
                          className="p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              {product.image_url && (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name} 
                                  className="w-8 h-8 rounded object-cover mr-3"
                                />
                              )}
                              <div>
                                <h5 className="font-medium text-gray-900 dark:text-white">{product.name}</h5>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {(product.retail_price || 0).toLocaleString('hu-HU')} Ft
                                </p>
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Order Items */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Rendelés tételei</h4>
                  
                  {orderItems.length === 0 ? (
                    <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">Nincsenek tételek</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {orderItems.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <h5 className="font-medium text-gray-900 dark:text-white">{item.name}</h5>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(item.price || 0).toLocaleString('hu-HU')} Ft/db
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    setOrderItems(orderItems.map((orderItem, i) =>
                                      i === index ? { ...orderItem, quantity: orderItem.quantity - 1 } : orderItem
                                    ))
                                  } else {
                                    setOrderItems(orderItems.filter((_, i) => i !== index))
                                  }
                                }}
                                className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => {
                                  setOrderItems(orderItems.map((orderItem, i) =>
                                    i === index ? { ...orderItem, quantity: orderItem.quantity + 1 } : orderItem
                                  ))
                                }}
                                className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-right mt-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {((item.price || 0) * item.quantity).toLocaleString('hu-HU')} Ft
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {orderItems.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Összesen:</span>
                        <span>{orderItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0).toLocaleString('hu-HU')} Ft</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowOrderForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={createOrder}
                  disabled={!orderCustomer || orderItems.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  Rendelés létrehozása
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Visszáru feldolgozása
                </h3>
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Eredeti tranzakció száma (opcionális)
                  </label>
                  <input
                    type="text"
                    value={originalTransaction}
                    onChange={(e) => setOriginalTransaction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="TX-20250116-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visszáru indoka
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Válasszon indokot</option>
                    <option value="defective">Hibás termék</option>
                    <option value="expired">Lejárt</option>
                    <option value="customer_request">Vevői kérés</option>
                    <option value="wrong_item">Téves termék</option>
                    <option value="other">Egyéb</option>
                  </select>
                </div>
                
                {/* Return Items */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Visszáru tételek</h4>
                    <button
                      onClick={() => {
                        setReturnItems([...returnItems, {
                          id: Date.now().toString(),
                          product_id: '',
                          name: '',
                          quantity: 1,
                          unit_price: 0,
                          total_price: 0,
                          reason: returnReason,
                          condition: 'good'
                        }])
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3 w-3 mr-1 inline" />
                      Tétel hozzáadása
                    </button>
                  </div>
                  
                  {returnItems.length === 0 ? (
                    <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <ArrowLeft className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">Nincsenek visszáru tételek</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {returnItems.map((item, index) => (
                        <div key={item.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <select
                                value={item.product_id}
                                onChange={(e) => {
                                  const selectedProduct = products.find(p => p.id === e.target.value)
                                  if (selectedProduct) {
                                    const updatedItems = [...returnItems]
                                    updatedItems[index] = {
                                      ...item,
                                      product_id: selectedProduct.id,
                                      name: selectedProduct.name,
                                      unit_price: selectedProduct.retail_price || 0,
                                      total_price: (selectedProduct.retail_price || 0) * item.quantity
                                    }
                                    setReturnItems(updatedItems)
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              >
                                <option value="">Válasszon terméket</option>
                                {products.map(product => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} - {(product.retail_price || 0).toLocaleString('hu-HU')} Ft
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const quantity = Number(e.target.value)
                                  const updatedItems = [...returnItems]
                                  updatedItems[index] = {
                                    ...item,
                                    quantity,
                                    total_price: item.unit_price * quantity
                                  }
                                  setReturnItems(updatedItems)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="Mennyiség"
                                min="1"
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.total_price.toLocaleString('hu-HU')} Ft
                              </span>
                              <button
                                onClick={() => {
                                  setReturnItems(returnItems.filter((_, i) => i !== index))
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {returnItems.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Visszatérítés összesen:</span>
                      <span>{returnItems.reduce((sum, item) => sum + item.total_price, 0).toLocaleString('hu-HU')} Ft</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={processReturn}
                  disabled={returnItems.length === 0 || !returnReason}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2 inline" />
                  Visszáru feldolgozása
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Movement Modal */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Pénzmozgás rögzítése
                </h3>
                <button
                  onClick={() => setShowCashModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Művelet típusa
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="deposit"
                        checked={cashOperation === 'deposit'}
                        onChange={(e) => setCashOperation(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Betét</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="withdrawal"
                        checked={cashOperation === 'withdrawal'}
                        onChange={(e) => setCashOperation(e.target.value as any)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Kivétel</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Összeg (Ft) *
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Indoklás *
                  </label>
                  <input
                    type="text"
                    value={cashReason}
                    onChange={(e) => setCashReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="pl. Váltópénz feltöltés"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bizonylat fotó (opcionális)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReceiptPhoto(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={recordCashMovement}
                  disabled={!cashAmount || !cashReason}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <DollarSign className="h-4 w-4 mr-2 inline" />
                  Rögzítés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          scanningFor={scannerMode === 'add-to-cart' ? 'search' : 'edit'}
        />
      )}
    </div>
  )
}
