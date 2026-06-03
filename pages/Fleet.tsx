import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Search, Edit, Trash2, Filter, Calendar, Clock, MapPin, AlertTriangle, CheckCircle, X, Camera, Save, User, FileText, Upload, Map, Navigation, Route as RouteIcon, Fuel, PenTool as Tool, Wrench, BarChart3, RefreshCw, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { trackGPSAPI, TrackGPSVehicle } from '../lib/trackgps-api';
// === JAVÍTVA: Helyes relatív útvonal és default import ===
import GPSTrackingDashboard from '../components/GPSTrackingDashboard';
// ======================================================

interface Vehicle {
  id: string;
  license_plate: string;
  type: string;
  model: string;
  year: number | null;
  capacity: number | null;
  fuel_type: string;
  fuel_consumption: number | null;
  insurance_expiry: string | null;
  technical_inspection: string | null;
  mileage: number;
  status: 'active' | 'maintenance' | 'inactive';
  driver_id: string | null;
  gps_tracker_id: string | null;
  last_service: string | null;
  next_service: string | null;
  location_id: string | null;
  image_url: string | null;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null; // Lehet null is
  locations?: {
    id: string;
    name: string;
    address: string;
    city: string;
  } | null; // Lehet null is
}

interface DamageReport {
  id: string;
  vehicle_id: string;
  report_date: string;
  description: string;
  location: string;
  reporter_id: string;
  status: 'reported' | 'in_review' | 'approved' | 'rejected' | 'fixed';
  images: string[];
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
  } | null; // Lehet null is
  vehicles?: {
    id: string;
    license_plate: string;
    model: string;
  } | null; // Lehet null is
}

interface Driver {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
}

interface Location {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
}

interface VehicleLocation {
  vehicleId: string;
  licensePlate: string;
  location: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    speed?: number | null;
    heading?: number | null;
    accuracy?: number | null;
  };
  status: 'moving' | 'stopped' | 'idle' | 'unknown'; // Added 'unknown' for safety
  driver?: string | null; // Driver name can be null
}

export default function Fleet() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  // === JAVÍTVA: Eltávolítva a duplikált rész ===
  const [showMapModal, setShowMapModal] = useState(false);
  // =======================================
  const [showGPSModal, setShowGPSModal] = useState(false); // Ez a GPS Dashboard Modal
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedGPSVehicle, setSelectedGPSVehicle] = useState<string | null>(null); // Ezt adod át a GPSTrackingDashboardnak
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation | null>(null); // Utolsó pozíció a Supabase táblához
  const [trackgpsVehicles, setTrackgpsVehicles] = useState<TrackGPSVehicle[]>([]);
  const [trackgpsLoading, setTrackgpsLoading] = useState(false);
  const [trackgpsError, setTrackgpsError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [damageImageFiles, setDamageImageFiles] = useState<File[]>([]);
  const [damageImagePreviews, setDamageImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const damageFileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null); // Ez a Map Modalhoz tartozik
  
  const PUBLIC_TRACKGPS_PUBLIC_MAP_URL = 'https://fleet.trackgps.ro/public-map/9DF91D48-3FA1-484B-AA96-50C261A8122C';
  
  // GPS Adatok Betöltése (Új jármű formhoz)
  const [loadingGPSData, setLoadingGPSData] = useState(false); // State a GPS adatok betöltésére
  const [gpsDataModal, setGpsDataModal] = useState(false); // State a GPS adatok betöltése modalra
  const [gpsTrackerId, setGpsTrackerId] = useState(''); // State a GPS tracker ID beviteli mezőhöz
  const [gpsVehicleData, setGpsVehicleData] = useState<any>(null); // State a betöltött GPS jármű adatok tárolására

  // Tab management
  const [activeTab, setActiveTab] = useState<'vehicles' | 'gps'>('vehicles'); // State a tab kiválasztásához

  const [vehicleFormData, setVehicleFormData] = useState({
    license_plate: '',
    type: 'truck',
    model: '',
    year: '',
    capacity: '',
    fuel_type: 'diesel',
    fuel_consumption: '',
    insurance_expiry: '',
    technical_inspection: '',
    mileage: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    driver_id: '',
    gps_tracker_id: '',
    last_service: '',
    next_service: '',
    location_id: ''
  });

  const [damageFormData, setDamageFormData] = useState({
    vehicle_id: selectedVehicle?.id || '',
    description: '',
    location: '',
    status: 'reported' as 'reported' | 'in_review' | 'approved' | 'rejected' | 'fixed'
  });

  // Init effects
  useEffect(() => {
    loadVehicles();
    loadDrivers();
    loadLocations();
    loadDamageReports();
    loadTrackGPSVehicles();
  }, []);

  // Load data from Supabase
  const loadVehicles = async () => {
    try {
      setLoading(true);

      // Load vehicles from database
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          profiles:driver_id (id, full_name, email, phone),
          locations:location_id (id, name, address, city)
        `)
        .order('license_plate');

      if (error) {
        console.error('Database error:', error);
        toast.error('Hiba a járművek betöltésekor');
        return;
      }

      if (data) {
        setVehicles(data as Vehicle[]); // Type assertion added
        // If there's a selected vehicle, update it with the new data
        if (selectedVehicle) {
          const updatedVehicle = data.find(v => v.id === selectedVehicle.id);
          if (updatedVehicle) {
            setSelectedVehicle(updatedVehicle as Vehicle); // Type assertion added
          }
        }
      }
    } catch (error) {
      console.error('Hiba a járművek betöltésekor:', error);
      toast.error('Hiba a járművek betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      // Load drivers from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role')
        .eq('role', 'driver')
        .eq('status', 'active') // Assuming drivers have an active status
        .order('full_name');

      if (error) {
        console.error('Database error:', error);
        return;
      }

      if (data) {
        setDrivers(data.map(driver => ({
          id: driver.id,
          name: driver.full_name,
          email: driver.email,
          phone: driver.phone
        })));
      }
    } catch (error) {
      console.error('Hiba a sofőrök betöltésekor:', error);
    }
  };

  const loadLocations = async () => {
    try {
      // Load locations from database
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, city')
        .eq('status', 'active') // Assuming locations have an active status
        .order('name');

      if (error) {
        console.error('Database error:', error);
        return;
      }

      if (data) {
        setLocations(data as Location[]); // Type assertion added
      }
    } catch (error) {
      console.error('Hiba a helyszínek betöltésekor:', error);
    }
  };

  const loadDamageReports = async () => {
    try {
      // Load damage reports from database
      const { data, error } = await supabase
        .from('vehicle_damage_reports')
        .select(`
          *,
          profiles:reporter_id (id, full_name),
          vehicles:vehicle_id (id, license_plate, model)
        `)
        .order('report_date', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return;
      }

      if (data) {
        setDamageReports(data as DamageReport[]); // Type assertion added
      }
    } catch (error) {
      console.error('Hiba a kárjelentések betöltésekor:', error);
    }
  };

  const loadTrackGPSVehicles = async () => {
    try {
      setTrackgpsLoading(true);
      setTrackgpsError(null);
      const data = await trackGPSAPI.getVehicles();
      setTrackgpsVehicles(data);
      if (!data || data.length === 0) {
        setTrackgpsError('Nincs elérhető GPS járműadat a TrackGPS API-ból.');
      }
    } catch (error) {
      console.error('TrackGPS data load error:', error);
      setTrackgpsVehicles([]);
      setTrackgpsError('A TrackGPS API nem válaszol. Ellenőrizd a proxy és a hitelesítést.');
    } finally {
      setTrackgpsLoading(false);
    }
  };

  // Form submit handlers
  const handleVehicleSubmit = async () => {
    try {
      setLoading(true);

      // Validate form data
      if (!vehicleFormData.license_plate || !vehicleFormData.model) {
        toast.error('Kérjük töltse ki a kötelező mezőket');
        return;
      }

      // Upload image if selected (using Base64 based on previous logic)
      let imageUrl = editingVehicle?.image_url || null;
      if (imageFile) {
        // Convert image to base64
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);

        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            resolve(reader.result as string);
          };
          reader.onerror = (error) => {
             reject(error);
          };
        });
      }

      // Prepare vehicle data - Ensure correct data types and nullability
      const vehicleDataToSave = {
        license_plate: vehicleFormData.license_plate,
        type: vehicleFormData.type,
        model: vehicleFormData.model,
        year: vehicleFormData.year ? parseInt(vehicleFormData.year) : null,
        capacity: vehicleFormData.capacity ? parseFloat(vehicleFormData.capacity) : null,
        fuel_type: vehicleFormData.fuel_type,
        fuel_consumption: vehicleFormData.fuel_consumption ? parseFloat(vehicleFormData.fuel_consumption) : null,
        insurance_expiry: vehicleFormData.insurance_expiry || null,
        technical_inspection: vehicleFormData.technical_inspection || null,
        mileage: vehicleFormData.mileage ? parseInt(vehicleFormData.mileage) : 0, // Assuming mileage is always a number, default 0
        status: vehicleFormData.status,
        driver_id: vehicleFormData.driver_id || null,
        gps_tracker_id: vehicleFormData.gps_tracker_id || null,
        last_service: vehicleFormData.last_service || null,
        next_service: vehicleFormData.next_service || null,
        location_id: vehicleFormData.location_id || null,
        image_url: imageUrl,
      };

      if (editingVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleDataToSave)
          .eq('id', editingVehicle.id);

        if (error) {
          console.error('Database error:', error);
          toast.error('Hiba a jármű frissítésekor');
          return;
        }

        toast.success('Jármű sikeresen frissítve!');
      } else {
        // Create new vehicle
        const { error } = await supabase
          .from('vehicles')
          .insert(vehicleDataToSave);

        if (error) {
          console.error('Database error:', error);
          toast.error('Hiba a jármű létrehozásakor');
          return;
        }

        toast.success('Jármű sikeresen létrehozva!');
      }

      // Reload vehicles and reset form
      loadVehicles();
      resetVehicleForm();
      setShowVehicleModal(false);
      setEditingVehicle(null);
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Hiba a jármű mentésekor:', error);
      toast.error('Hiba a jármű mentésekor');
    } finally {
      setLoading(false);
    }
  };

  const handleDamageSubmit = async () => {
    try {
      setLoading(true);

      // Validate form data
      if (!damageFormData.vehicle_id || !damageFormData.description || !damageFormData.location) {
        toast.error('Kérjük töltse ki a kötelező mezőket');
        return;
      }

      // Upload images if selected (using Base64 based on previous logic)
      const imageUrls: string[] = [];

      for (const file of damageImageFiles) {
         // Convert image to base64
        const reader = new FileReader();
        reader.readAsDataURL(file);

        const base64Image = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            resolve(reader.result as string);
          };
          reader.onerror = (error) => {
             reject(error);
          };
        });
        imageUrls.push(base64Image);
      }

      // Prepare damage report data
      const damageDataToSave = {
        vehicle_id: damageFormData.vehicle_id,
        report_date: new Date().toISOString().split('T')[0], // Date only format 'YYYY-MM-DD'
        description: damageFormData.description,
        location: damageFormData.location,
        reporter_id: user?.id, // Assuming user is logged in and user.id is available
        status: damageFormData.status,
        images: imageUrls,
      };

      // Create new damage report
      const { error } = await supabase
        .from('vehicle_damage_reports')
        .insert(damageDataToSave);

      if (error) {
        console.error('Database error:', error);
        toast.error('Hiba a kárjelentés létrehozásakor');
        return;
      }

      toast.success('Kárjelentés sikeresen létrehozva!');

      // Reload damage reports and reset form
      loadDamageReports();
      resetDamageForm();
      setShowDamageModal(false);
      setDamageImageFiles([]);
      setDamageImagePreviews([]);
    } catch (error) {
      console.error('Hiba a kárjelentés mentésekor:', error);
      toast.error('Hiba a kárjelentés mentésekor');
    } finally {
      setLoading(false);
    }
  };

  // Handle GPS data loading for the form
  const loadGPSVehicleData = async () => {
    if (!gpsTrackerId.trim()) {
      toast.error('Kérjük adja meg a GPS tracker ID-t');
      return;
    }

    try {
      setLoadingGPSData(true);

      // Assuming trackGPSAPI object has a method like getVehicleByTrackerId
      // This method would call the TrackGPS API (e.g., Company-vehicles and find the one with matching tracker ID)
      // NOTE: Based on previous discussion, TrackGPS API provides vehicles by VehicleId or VehicleUId,
      // not directly by "GPS tracker ID" which might be plate or a custom field.
      // You need to implement this logic in trackgps-api.ts
      const vehiclesFromTrackGps = await trackGPSAPI.getVehicles(); // This should call /api/carriers/company-vehicles

      // Find the vehicle by its TrackGPS unique ID (VehicleUId) or Registration Number (plate)
      // Using vehicle.gps_tracker_id as the identifier for TrackGPS API
      const vehicleData = vehiclesFromTrackGps.find(v =>
        v.vehicleUId === gpsTrackerId || v.plateNumber === gpsTrackerId // Assuming tracker ID could be UId or plate
      );


      if (!vehicleData) {
        toast.error('Nem található jármű ezzel a GPS tracker ID-val');
        setGpsVehicleData(null); // Clear previous data if not found
        return;
      }

      setGpsVehicleData(vehicleData); // Store the found API data temporarily

      // Auto-fill form with GPS data from TrackGPS API
      setVehicleFormData(prev => ({
        ...prev,
        license_plate: vehicleData.plateNumber || '',
        model: vehicleData.model || '',
        year: vehicleData.year?.toString() || '',
        // fuel_type: vehicleData.fuelType === 'petrol' ? 'petrol' :
        //            vehicleData.fuelType === 'diesel' ? 'diesel' : 'diesel', // This mapping might need adjustment
        fuel_consumption: vehicleData.fuel_consumption || '',
        mileage: vehicleData.mileage || '',
        gps_tracker_id: gpsTrackerId, // Keep the entered tracker ID
        status: 'active' // Default status
      }));

      toast.success('GPS adatok sikeresen betöltve!');
      // setGpsDataModal(false); // Optionally close modal after load, but preview is useful

    } catch (error) {
      console.error('Hiba a GPS adatok betöltésekor:', error);
      toast.error('Hiba a GPS adatok betöltésekor');
       setGpsVehicleData(null); // Clear preview on error
    } finally {
      setLoadingGPSData(false);
    }
  };

  // Reset form data
  const resetVehicleForm = () => {
    setVehicleFormData({
      license_plate: '',
      type: 'truck',
      model: '',
      year: '',
      capacity: '',
      fuel_type: 'diesel',
      fuel_consumption: '',
      insurance_expiry: '',
      technical_inspection: '',
      mileage: '',
      status: 'active',
      driver_id: '',
      gps_tracker_id: '',
      last_service: '',
      next_service: '',
      location_id: ''
    });
  };

  const resetDamageForm = () => {
    setDamageFormData({
      vehicle_id: selectedVehicle?.id || '', // Pre-select vehicle if viewing details
      description: '',
      location: '',
      status: 'reported',
    });
  };

  // Handle vehicle actions
  const editVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      license_plate: vehicle.license_plate,
      type: vehicle.type,
      model: vehicle.model,
      year: vehicle.year?.toString() || '',
      capacity: vehicle.capacity?.toString() || '',
      fuel_type: vehicle.fuel_type,
      fuel_consumption: vehicle.fuel_consumption?.toString() || '',
      insurance_expiry: vehicle.insurance_expiry || '',
      technical_inspection: vehicle.technical_inspection || '',
      mileage: vehicle.mileage?.toString() || '',
      status: vehicle.status,
      driver_id: vehicle.driver_id || '',
      gps_tracker_id: vehicle.gps_tracker_id || '',
      last_service: vehicle.last_service || '',
      next_service: vehicle.next_service || '',
      location_id: vehicle.location_id || ''
    });
    setImagePreview(vehicle.image_url); // Set existing image preview
    setShowVehicleModal(true);
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a járművet?')) {
      return;
    }

    try {
      setLoading(true);

      // Delete vehicle
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Database error:', error);
        toast.error('Hiba a jármű törlésekor');
        return;
      }

      toast.success('Jármű sikeresen törölve!');
      loadVehicles(); // Reload list

      // If the deleted vehicle was selected, clear selection
      if (selectedVehicle && selectedVehicle.id === id) {
        setSelectedVehicle(null);
      }
    } catch (error) {
      console.error('Hiba a jármű törlésekor:', error);
      toast.error('Hiba a jármű törlésekor');
    } finally {
      setLoading(false);
    }
  };

  const viewVehicle = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle); // Open details modal

    // Load and display real-time location data from TrackGPS API if available
    // This runs asynchronously, the modal will show a loading state or previous data first
    if (vehicle.gps_tracker_id) {
      try {
        // Assuming trackGPSAPI.getVehicles() calls the /api/carriers/company-vehicles endpoint
        const gpsVehicles = await trackGPSAPI.getVehicles();

        // Find the vehicle by its TrackGPS unique ID (VehicleUId) or by the license plate stored in gps_tracker_id
        const gpsVehicle = gpsVehicles.find(v =>
          v.vehicleUId === vehicle.gps_tracker_id ||
          v.plateNumber === vehicle.gps_tracker_id
        )

        // Check if vehicle is found and has location data
        if (gpsVehicle && gpsVehicle.lastPosition?.latitude != null && gpsVehicle.lastPosition?.longitude != null && gpsVehicle.lastPosition.timestamp) {
           const speed = gpsVehicle.lastPosition.speed ?? undefined;
           const heading = gpsVehicle.lastPosition.course ?? undefined;
           const driverName = gpsVehicle.driverName || undefined; // Assuming API returns driverName

          setVehicleLocation({
            vehicleId: vehicle.id,
            licensePlate: vehicle.license_plate,
            location: {
              latitude: gpsVehicle.lastPosition.latitude,
              longitude: gpsVehicle.lastPosition.longitude,
              timestamp: new Date(gpsVehicle.lastPosition.timestamp),
              speed,
              heading,
              accuracy: 5 // Assuming some default accuracy or get from API if available
            },
            status: gpsVehicle.status ?? (speed !== undefined && speed > 0 ? 'moving' : (speed === 0 ? 'stopped' : 'unknown')),
            driver: driverName // Pass driver name from GPS API if available
          });
        } else {
            console.warn(`No real-time GPS data found for vehicle ${vehicle.license_plate} (${vehicle.gps_tracker_id}) or data is incomplete.`);
             setVehicleLocation(null); // Clear previous location if data is not found or incomplete
        }
      } catch (error) {
        console.error('Hiba a jármű helyadatainak lekérdezésekor:', error);
        setVehicleLocation(null); // Clear previous location on error
        // toast.error('Hiba a jármű helyadatainak lekérdezésekor'); // Optional: notify user of real-time data fetch error
      }
    } else {
        setVehicleLocation(null); // Clear location if no GPS tracker ID is assigned
    }
  };


  // Handle image uploads
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file); // Read as Base64
    }
  };

  const handleDamageImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setDamageImageFiles(prev => [...prev, ...newFiles]);

      // Create previews for new files
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
           setDamageImagePreviews(prev => [...prev, e.target?.result as string]); // Add each new preview individually
        };
        reader.readAsDataURL(file); // Read as Base64
      });
    }
  };

  const removeDamageImage = (index: number) => {
    setDamageImageFiles(prev => prev.filter((_, i) => i !== index));
    setDamageImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Map Modal (Placeholder)
  const showMap = () => {
    // Only show map if location data is available
    if (vehicleLocation) {
        setShowMapModal(true);

        // Initialize map in next tick
        // NOTE: This is a placeholder. A real map implementation requires a map library (like Google Maps, Leaflet)
        // and API key, and proper initialization within the modal.
        setTimeout(() => {
          if (mapRef.current && vehicleLocation) {
            // In a real implementation, this would use a map API to display the location
            mapRef.current.innerHTML = `
              <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0; color: #333; font-size: 16px;">
                <div style="text-align: center;">
                  <div style="margin-bottom: 10px;">Jármű helyzete: ${vehicleLocation.location.latitude.toFixed(6)}, ${vehicleLocation.location.longitude.toFixed(6)}</div>
                  <div>Sebesség: ${vehicleLocation.location.speed?.toFixed(1) || 0} km/h</div>
                  <div>Státusz: ${vehicleLocation.status === 'moving' ? 'Mozgásban' : vehicleLocation.status === 'idle' ? 'Tétlen' : vehicleLocation.status === 'unknown' ? 'Ismeretlen' : 'Áll'}</div>
                  <div>Utolsó frissítés: ${vehicleLocation.location.timestamp.toLocaleTimeString('hu-HU')}</div>
                   ${vehicleLocation.driver ? `<div>Sofőr (GPS): ${vehicleLocation.driver}</div>` : ''}
                </div>
              </div>
            `;
          }
        }, 100); // Small delay to ensure modal is rendered
    } else {
        toast.error("Nincs elérhető helyadat ehhez a járműhöz.");
    }
  };

  // Helper functions for status display
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'maintenance': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Aktív';
      case 'maintenance': return 'Karbantartás';
      case 'inactive': return 'Inaktív';
      default: return status;
    }
  };

  const getDamageStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'in_review': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'rejected': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'fixed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getDamageStatusText = (status: string) => {
    switch (status) {
      case 'reported': return 'Bejelentve';
      case 'in_review': return 'Felülvizsgálat alatt';
      case 'approved': return 'Jóváhagyva';
      case 'rejected': return 'Elutasítva';
      case 'fixed': return 'Javítva';
      default: return status;
    }
  };

  // Filter vehicles based on search and status
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch =
      vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vehicle.gps_tracker_id && vehicle.gps_tracker_id.toLowerCase().includes(searchTerm.toLowerCase())); // Also search by GPS tracker ID

    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filter damage reports for selected vehicle
  const filteredDamageReports = damageReports.filter(report =>
    selectedVehicle ? report.vehicle_id === selectedVehicle.id : false // Only show reports if a vehicle is selected
  );


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Truck className="h-8 w-8 mr-3 text-blue-600" />
            Flotta & GPS Tracking
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Járművek, szállítások és valós idejű GPS nyomkövetés
          </p>
        </div>
        <div className="flex space-x-3">
          {/* Button to open the main GPS Dashboard view */}
           <button
            type="button" // Added type button
            onClick={() => setActiveTab('gps')} // Switch to the GPS tab
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/25"
          >
            <Activity className="h-5 w-5 mr-2" />
            GPS Dashboard
          </button>
          {/* Button to add a new vehicle (opens form modal) */}
          <button
            type="button" // Added type button
            onClick={() => {
              resetVehicleForm(); // Clear form for new entry
              setEditingVehicle(null); // Ensure we're creating, not editing
              setImageFile(null); // Clear image state
              setImagePreview(null);
              setShowVehicleModal(true); // Open the form modal
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új jármű
          </button>
          {/* Button to open the GPS data loading modal (for form auto-fill) */}
          <button
            type="button" // Added type button
            onClick={() => {
              setGpsTrackerId(''); // Clear previous tracker ID
              setGpsVehicleData(null); // Clear previous GPS data preview
              setGpsDataModal(true); // Open the GPS data modal
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-500/25"
          >
            <Navigation className="h-5 w-5 mr-2" />
            GPS adatok betöltése
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
        <button
          type="button" // Added type button
          onClick={() => setActiveTab('vehicles')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'vehicles'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Truck className="h-4 w-4 mr-2 inline" />
          Járművek
        </button>
        <button
          type="button" // Added type button
          onClick={() => setActiveTab('gps')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'gps'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4 mr-2 inline" />
          GPS Tracking
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'vehicles' && (
        <>
          {/* Public Map - Only visible in Vehicles tab */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Map className="h-5 w-5 mr-2 text-blue-600" />
                Flotta térkép
              </h2>
              <button
                type="button"
                onClick={() => window.open(PUBLIC_TRACKGPS_PUBLIC_MAP_URL, '_blank')}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Teljes képernyő
              </button>
            </div>

            {/* iframe for public map */}
            <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              {trackgpsLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/10">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}

              <iframe
                title="TrackGPS Flotta térkép"
                src={PUBLIC_TRACKGPS_PUBLIC_MAP_URL}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                loading="lazy"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <a
                href={PUBLIC_TRACKGPS_PUBLIC_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Külső TrackGPS térkép megnyitása
              </a>
            </div>

            {/* Map key/legend */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Mozgásban</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Leállítva</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Üresjárat</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Offline</span>
              </div>
            </div>
          </div>

          {/* Filters - Only visible in Vehicles tab */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Keresés
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="search"
                    type="text"
                    placeholder="Rendszám, modell vagy GPS ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Állapot
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Összes állapot</option>
                  <option value="active">Aktív</option>
                  <option value="maintenance">Karbantartás</option>
                  <option value="inactive">Inaktív</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vehicles Grid - Only visible in Vehicles tab */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && vehicles.length === 0 ? (
              <div className="col-span-3 flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="col-span-3 text-center py-12">
                <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nincsenek járművek</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Még nem adott hozzá járműveket a flottához.
                </p>
                <button
                  type="button" // Added type button
                  onClick={() => {
                    resetVehicleForm();
                    setEditingVehicle(null);
                    setShowVehicleModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Új jármű
                </button>
              </div>
            ) : (
              filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 cursor-pointer" // Added cursor-pointer to indicate clickable
                   onClick={() => viewVehicle(vehicle)} // Make the whole card clickable to view details
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                        <Truck className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vehicle.model}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{vehicle.license_plate}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      {getStatusText(vehicle.status)}
                    </span>
                  </div>

                  <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg mb-4 overflow-hidden">
                    {vehicle.image_url ? (
                      <img
                        src={vehicle.image_url}
                        alt={vehicle.model}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Truck className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Típus:</span>
                      <span className="text-gray-900 dark:text-white">{vehicle.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Évjárat:</span>
                      <span className="text-gray-900 dark:text-white">{vehicle.year || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Kilométeróra:</span>
                      <span className="text-gray-900 dark:text-white">{vehicle.mileage?.toLocaleString('hu-HU') || 0} km</span>
                    </div>
                     {/* Driver */}
                     {vehicle.profiles && vehicle.profiles.full_name && (
                         <div className="flex justify-between">
                           <span className="text-gray-500 dark:text-gray-400">Sofőr:</span>
                           <span className="text-gray-900 dark:text-white">{vehicle.profiles.full_name}</span>
                         </div>
                     )}
                    {/* Location */}
                    {vehicle.locations && vehicle.locations.name && (
                         <div className="flex justify-between">
                           <span className="text-gray-500 dark:text-gray-400">Helyszín:</span>
                           <span className="text-gray-900 dark:text-white">{vehicle.locations.name}</span>
                         </div>
                     )}
                  </div>

                   {/* Actions Row - Separate from the clickable card body */}
                  <div className="flex justify-end space-x-2 mt-4 border-t pt-4 border-gray-200 dark:border-gray-700">
                     <button
                        type="button" // Added type button
                        onClick={(e) => { // Stop propagation to prevent card click
                           e.stopPropagation();
                           editVehicle(vehicle);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                     >
                        <Edit className="h-5 w-5" />
                     </button>
                     <button
                        type="button" // Added type button
                        onClick={(e) => { // Stop propagation to prevent card click
                           e.stopPropagation();
                           deleteVehicle(vehicle.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                     >
                        <Trash2 className="h-5 w-5" />
                     </button>
                     {vehicle.gps_tracker_id && (
                         <button
                             type="button" // Added type button
                             onClick={(e) => { // Stop propagation
                                 e.stopPropagation();
                                 // Option 1: Switch to GPS tab and select this vehicle
                                 setSelectedGPSVehicle(vehicle.gps_tracker_id); // Pass the tracker ID
                                 setActiveTab('gps');
                                 // Option 2: Open a small map modal directly from the card (like the one in details)
                                 // For now, Option 1 seems aligned with the tab structure
                             }}
                             className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                         >
                             <Navigation className="h-5 w-5" /> {/* Or a Map icon */}
                         </button>
                     )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* GPS Tracking Dashboard Tab Content */}
      {activeTab === 'gps' && (
         // Render the GPSTrackingDashboard component when the GPS tab is active
         <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 min-h-[600px]"> {/* Added min-height for visibility */}
           {/* Passing the selectedVehicleTrackerId prop */}
           <GPSTrackingDashboard
             selectedVehicle={selectedGPSVehicle}
             onVehicleSelect={setSelectedGPSVehicle}
             // You might need to pass 'vehicles' list or other data here
             // depending on how GPSTrackingDashboard is implemented
           />
         </div>
      )}


      {/* Vehicle Details Modal (Remains the same for viewing details from 'vehicles' tab) */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mr-4">
                    <Truck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedVehicle.model}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{selectedVehicle.license_plate}</p>
                  </div>
                </div>
                <button
                  type="button" // Added type button
                  onClick={() => setSelectedVehicle(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div>
                  <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg mb-4 overflow-hidden">
                    {selectedVehicle.image_url ? (
                      <img
                        src={selectedVehicle.image_url}
                        alt={selectedVehicle.model}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Truck className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-sm"> {/* Added text-sm here */}
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">Jármű adatok</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Típus:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Évjárat:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.year || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Kapacitás:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.capacity || 'N/A'} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Kilométeróra:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.mileage?.toLocaleString('hu-HU') || 0} km</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Üzemanyag:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.fuel_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Fogyasztás:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.fuel_consumption || 'N/A'} l/100km</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Biztosítás lejárat:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.insurance_expiry || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Műszaki vizsga:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.technical_inspection || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Utolsó szerviz:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.last_service || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Következő szerviz:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.next_service || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">GPS tracker ID:</span>
                        <span className="text-gray-900 dark:text-white">{selectedVehicle.gps_tracker_id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Állapot:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedVehicle.status)}`}>
                          {getStatusText(selectedVehicle.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm"> {/* Added text-sm here */}
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">Sofőr</h3>
                    {selectedVehicle.profiles ? (
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedVehicle.profiles.full_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedVehicle.profiles.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Nincs hozzárendelt sofőr</p>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  {/* Location */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-sm"> {/* Added text-sm here */}
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">Helyzet</h3>
                      {selectedVehicle.gps_tracker_id && vehicleLocation && ( // Only show map button if tracker ID exists AND location data is loaded
                        <button
                          type="button" // Added type button
                          onClick={showMap}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                        >
                          Térkép megnyitása
                        </button>
                      )}
                    </div>

                    {/* Display real-time location or message */}
                    {loading && selectedVehicle.gps_tracker_id ? ( // Show loader specifically for location if tracker ID exists
                         <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                         </div>
                    ) : vehicleLocation ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Koordináták:</span>
                          <span className="text-gray-900 dark:text-white">
                            {vehicleLocation.location.latitude.toFixed(6)}, {vehicleLocation.location.longitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Sebesség:</span>
                          <span className="text-gray-900 dark:text-white">
                            {vehicleLocation.location.speed?.toFixed(1) || 0} km/h
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Állapot:</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            vehicleLocation.status === 'moving'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                          }`}>
                            {vehicleLocation.status === 'moving' ? 'Mozgásban' : 'Áll'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Utolsó frissítés:</span>
                          <span className="text-gray-900 dark:text-white">
                            {vehicleLocation.location.timestamp.toLocaleTimeString('hu-HU')}
                          </span>
                        </div>
                         {vehicleLocation.driver && (
                             <div className="flex justify-between text-sm">
                               <span className="text-gray-500 dark:text-gray-400">Sofőr (GPS):</span>
                               <span className="text-gray-900 dark:text-white">{vehicleLocation.driver}</span>
                             </div>
                         )}
                      </div>
                    ) : selectedVehicle.gps_tracker_id ? (
                       <p className="text-gray-500 dark:text-gray-400">GPS adatok betöltése...</p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Nincs GPS tracker hozzárendelve</p>
                    )}
                  </div>

                  {/* Damage Reports */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-sm"> {/* Added text-sm here */}
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">Kárjelentések</h3>
                      <button
                        type="button" // Added type button
                        onClick={() => {
                          resetDamageForm();
                          // Set the vehicle ID for the new damage report automatically
                          setDamageFormData(prev => ({ ...prev, vehicle_id: selectedVehicle?.id || '' }));
                          setDamageImageFiles([]); // Clear images for new report
                          setDamageImagePreviews([]);
                          setShowDamageModal(true); // Open the damage report modal
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2 inline" />
                        Új kárjelentés
                      </button>
                    </div>

                    {filteredDamageReports.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">Nincsenek kárjelentések ehhez a járműhöz.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredDamageReports.map((report) => (
                          <div key={report.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm"> {/* Added text-sm here */}
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{report.description}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400"> {/* Adjusted font size */}
                                  {new Date(report.report_date).toLocaleDateString('hu-HU')} - {report.location}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDamageStatusColor(report.status)}`}>
                                {getDamageStatusText(report.status)}
                              </span>
                            </div>

                            {report.images && report.images.length > 0 && (
                              <div className="mt-2 flex space-x-2 overflow-x-auto pb-2">
                                {report.images.map((image, index) => (
                                  <img
                                    key={index}
                                    src={image} // Assuming images are stored as Base64 URLs or publicly accessible URLs
                                    alt={`Kár ${index + 1}`}
                                    className="h-16 w-16 object-cover rounded-lg"
                                  />
                                ))}
                              </div>
                            )}

                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400"> {/* Adjusted font size */}
                              Bejelentő: {report.profiles?.full_name || 'Ismeretlen'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button" // Added type button
                      onClick={() => {
                         editVehicle(selectedVehicle); // Open edit modal with selected vehicle data
                         setSelectedVehicle(null); // Close details modal
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Edit className="h-4 w-4 mr-2 inline" />
                      Szerkesztés
                    </button>
                    {/* New Damage Report button moved inside the Damage Reports section */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal (Add/Edit) */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingVehicle ? 'Jármű szerkesztése' : 'Új jármű'}
                </h2>
                <button
                  type="button" // Added type button
                  onClick={() => setShowVehicleModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Rendszám *
                    </label>
                    <input
                      id="license_plate"
                      type="text"
                      value={vehicleFormData.license_plate}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, license_plate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="gps_tracker_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      GPS tracker ID
                    </label>
                    <div className="flex space-x-2">
                      <input
                        id="gps_tracker_id"
                        type="text"
                        value={vehicleFormData.gps_tracker_id}
                        onChange={(e) => setVehicleFormData(prev => ({ ...prev, gps_tracker_id: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button" // Added type button to prevent form submission
                        onClick={() => {
                          setGpsTrackerId(vehicleFormData.gps_tracker_id); // Set the tracker ID for the loading modal
                          setGpsDataModal(true); // Open the GPS data loading modal
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!vehicleFormData.gps_tracker_id.trim()} // Disable if tracker ID is empty
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      GPS tracker ID megadásával automatikusan betölthetők a jármű adatok (pl. Rendszám, Modell, Évjárat, KM)
                    </p>
                  </div>

                  <div>
                    <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Modell *
                    </label>
                    <input
                      id="model"
                      type="text"
                      value={vehicleFormData.model}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Típus
                    </label>
                    <select
                      id="type"
                      value={vehicleFormData.type}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="truck">Teherautó</option>
                      <option value="van">Furgon</option>
                      <option value="car">Személyautó</option>
                      <option value="other">Egyéb</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Évjárat
                    </label>
                    <input
                      id="year"
                      type="number"
                      value={vehicleFormData.year}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, year: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kapacitás (kg)
                    </label>
                    <input
                      id="capacity"
                      type="number"
                      value={vehicleFormData.capacity}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, capacity: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="fuel_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Üzemanyag típus
                    </label>
                    <select
                      id="fuel_type"
                      value={vehicleFormData.fuel_type}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, fuel_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="diesel">Dízel</option>
                      <option value="petrol">Benzin</option>
                      <option value="electric">Elektromos</option>
                      <option value="hybrid">Hibrid</option>
                      <option value="gas">Gáz</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="fuel_consumption" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fogyasztás (l/100km)
                    </label>
                    <input
                      id="fuel_consumption"
                      type="number"
                      step="0.1"
                      value={vehicleFormData.fuel_consumption}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, fuel_consumption: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kilométeróra
                    </label>
                    <input
                      id="mileage"
                      type="number"
                      value={vehicleFormData.mileage}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, mileage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="image_upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jármű kép
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        id="image_upload"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button" // Added type button to prevent form submission
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        <Camera className="h-5 w-5 mr-2 inline" />
                        Kép feltöltése
                      </button>
                      {imagePreview && (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-16 w-16 object-cover rounded-lg"
                          />
                          <button
                             type="button" // Added type button
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="insurance_expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Biztosítás lejárat
                    </label>
                    <input
                      id="insurance_expiry"
                      type="date"
                      value={vehicleFormData.insurance_expiry}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, insurance_expiry: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="technical_inspection" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Műszaki vizsga
                    </label>
                    <input
                      id="technical_inspection"
                      type="date"
                      value={vehicleFormData.technical_inspection}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, technical_inspection: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="last_service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Utolsó szerviz
                    </label>
                    <input
                      id="last_service"
                      type="date"
                      value={vehicleFormData.last_service}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, last_service: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="next_service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Következő szerviz
                    </label>
                    <input
                      id="next_service"
                      type="date"
                      value={vehicleFormData.next_service}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, next_service: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="driver_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sofőr
                    </label>
                    <select
                      id="driver_id"
                      value={vehicleFormData.driver_id}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, driver_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Nincs hozzárendelve</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="location_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Helyszín
                    </label>
                    <select
                      id="location_id"
                      value={vehicleFormData.location_id}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, location_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Nincs hozzárendelve</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Állapot
                    </label>
                    <select
                      id="status"
                      value={vehicleFormData.status}
                      onChange={(e) => setVehicleFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'maintenance' | 'inactive' }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">Aktív</option>
                      <option value="maintenance">Karbantartás</option>
                      <option value="inactive">Inaktív</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button" // Added type button
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  type="button" // Added type button
                  onClick={handleVehicleSubmit}
                  disabled={loading || !vehicleFormData.license_plate || !vehicleFormData.model}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : editingVehicle ? 'Frissítés' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS Data Loading Modal (For Auto-filling Form) */}
      {gpsDataModal && (
        <div className="fixed inset-0 bg-black bg-opacity50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  GPS adatok betöltése
                </h2>
                <button
                  type="button" // Added type button
                  onClick={() => setGpsDataModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="gps_tracker_id_modal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GPS Tracker ID *
                  </label>
                  <input
                    id="gps_tracker_id_modal"
                    type="text"
                    value={gpsTrackerId}
                    onChange={(e) => setGpsTrackerId(e.target.value)}
                    placeholder="pl. RKA-376, JOV-030, LSF-606..." // Added examples
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Adja meg a TrackGPS rendszerben található GPS tracker azonosítót (lehet a rendszám is)
                  </p>
                </div>

                {/* Display loaded data preview */}
                {gpsVehicleData && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-sm"> {/* Added text-sm here */}
                    <h3 className="font-medium text-green-800 dark:text-green-400 mb-2">
                      Betöltött adatok előnézete:
                    </h3>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Rendszám:</span>
                        <span className="text-gray-900 dark:text-white">{gpsVehicleData.vehicleRegistrationNumber || 'N/A'}</span> {/* Use API field names */}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Modell:</span>
                        <span className="text-gray-900 dark:text-white">{gpsVehicleData.vehicleModel || 'N/A'}</span> {/* Use API field names */}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Évjárat:</span>
                        <span className="text-gray-900 dark:text-white">{gpsVehicleData.manufactureYear || 'N/A'}</span> {/* Use API field names */}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Kilométeróra:</span>
                        <span className="text-gray-900 dark:text-white">{gpsVehicleData.kmIndex?.toLocaleString('hu-HU') || 0} km</span> {/* Use API field names */}
                      </div>
                    </div>
                  </div>
                )}
                {/* Loading indicator within modal */}
                 {loadingGPSData && !gpsVehicleData && (
                     <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                     </div>
                 )}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button" // Added type button
                  onClick={() => setGpsDataModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  type="button" // Added type button
                  onClick={loadGPSVehicleData}
                  disabled={loadingGPSData || !gpsTrackerId.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {loadingGPSData ? 'Betöltés...' : 'Adatok betöltése'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Damage Report Modal */}
      {showDamageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Új kárjelentés
                </h2>
                <button
                  type="button" // Added type button
                  onClick={() => setShowDamageModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="damage_vehicle_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Jármű *
                  </label>
                  <select
                    id="damage_vehicle_id"
                    value={damageFormData.vehicle_id}
                    onChange={(e) => setDamageFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    disabled={!!selectedVehicle} // Disable dropdown if viewing details of a specific vehicle
                  >
                    <option value="">Válasszon járművet</option>
                    {vehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="damage_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leírás *
                  </label>
                  <textarea
                    id="damage_description"
                    value={damageFormData.description}
                    onChange={(e) => setDamageFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="damage_location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Helyszín *
                  </label>
                  <input
                    id="damage_location"
                    type="text"
                    value={damageFormData.location}
                    onChange={(e) => setDamageFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="damage_status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Állapot
                  </label>
                  <select
                    id="damage_status"
                    value={damageFormData.status}
                    onChange={(e) => setDamageFormData(prev => ({ ...prev, status: e.target.value as 'reported' | 'in_review' | 'approved' | 'rejected' | 'fixed' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="reported">Bejelentve</option>
                    <option value="in_review">Felülvizsgálat alatt</option>
                    <option value="approved">Jóváhagyva</option>
                    <option value="rejected">Elutasítva</option>
                    <option value="fixed">Javítva</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Képek
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      ref={damageFileInputRef}
                      onChange={handleDamageImageUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                       type="button" // Added type button
                      onClick={() => damageFileInputRef.current?.click()}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Camera className="h-5 w-5 mr-2 inline" />
                      Képek feltöltése
                    </button>
                  </div>

                  {damageImagePreviews.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {damageImagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="h-16 w-16 object-cover rounded-lg"
                          />
                          <button
                             type="button" // Added type button
                            onClick={() => removeDamageImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button" // Added type button
                  onClick={() => setShowDamageModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  type="button" // Added type button
                  onClick={handleDamageSubmit}
                  disabled={loading || !damageFormData.vehicle_id || !damageFormData.description || !damageFormData.location}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal (Placeholder) */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Jármű helyzete: {selectedVehicle?.license_plate}
                </h2>
                <button
                  type="button" // Added type button
                  onClick={() => setShowMapModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Map container (Placeholder content generated in showMap function) */}
              <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg" ref={mapRef}></div>

              <div className="flex justify-end mt-6">
                <button
                  type="button" // Added type button
                  onClick={() => setShowMapModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}