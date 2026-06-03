import React, { useState, useEffect } from 'react';
import { X, Save, Menu, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface MenuPermissionsModalProps {
  employee: {
    id: string;
    full_name: string;
    email: string;
    permissions?: string[];
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function MenuPermissionsModal({ employee, onClose, onSaved }: MenuPermissionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState<{path: string, label: string}[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    loadMenuItems();
    if (employee.permissions) {
      setSelectedPermissions(employee.permissions);
    }
  }, [employee]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      
      // These are the menu items that can be assigned as additional permissions
      const availableMenuItems = [
        { path: 'production', label: 'Termelés' },
        { path: 'orders', label: 'Rendelések' },
        { path: 'pos', label: 'POS' },
        { path: 'fleet', label: 'Flotta' },
        { path: 'recipes', label: 'Receptek' },
        { path: 'inventory', label: 'Készlet' },
        { path: 'locations', label: 'Helyszínek' },
        { path: 'schedules', label: 'Beosztások' },
        { path: 'reports', label: 'Jelentések' },
        { path: 'documents', label: 'Dokumentumok' },
        { path: 'ai-assistant', label: 'AI Asszisztens' },
        { path: 'sensors', label: 'Szenzorok' },
        { path: 'weather', label: 'Időjárás' },
        { path: 'ai-schedule', label: 'AI Beosztás' },
        { path: 'route-optimization', label: 'Útvonal Optimalizálás' },
        { path: 'hotel-occupancy', label: 'Szállásfoglalás' },
        { path: 'security', label: 'Biztonság' },
        { path: 'system-visualization', label: 'Rendszer Vizualizáció' },
        { path: 'chat', label: 'Chat' },
        { path: 'delivery-notes', label: 'Szállítólevelek' },
        { path: 'remote-control', label: 'Távoli irányítás' },
        { path: 'invoices', label: 'Számlák' },
        { path: 'payments', label: 'Fizetések' }
      ];
      
      setMenuItems(availableMenuItems);
    } catch (error) {
      console.error('Error loading menu items:', error);
      toast.error('Hiba a menüelemek betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (path: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      } else {
        return [...prev, path];
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ permissions: selectedPermissions })
        .eq('id', employee.id);
      
      if (error) {
        console.error('Error updating permissions:', error);
        toast.error('Hiba a jogosultságok mentésekor');
        return;
      }
      
      toast.success('Jogosultságok sikeresen mentve!');
      onSaved();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Hiba a jogosultságok mentésekor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Menu className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Menü jogosultságok: {employee.full_name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Itt beállíthatja, hogy {employee.full_name} milyen extra menüpontokhoz férjen hozzá az alapértelmezett szerepkörén túl.
              A kiválasztott menüpontok hozzáadódnak a felhasználó alap jogosultságaihoz.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {menuItems.map((item) => (
                <div 
                  key={item.path}
                  onClick={() => togglePermission(item.path)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedPermissions.includes(item.path)
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                    {selectedPermissions.includes(item.path) && (
                      <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Mentés...' : 'Mentés'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}