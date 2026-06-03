import React, { useState } from 'react';
import { X, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface RequestDataModalProps {
  employee: {
    id: string;
    full_name: string;
    email: string;
  };
  onClose: () => void;
  onSent: () => void;
}

export default function RequestDataModal({ employee, onClose, onSent }: RequestDataModalProps) {
  const [message, setMessage] = useState(
    `Tisztelt ${employee.full_name}!\n\nKérjük, töltse ki a hiányzó személyes adatait a profil oldalon. Ezek az adatok szükségesek a munkaügyi adminisztrációhoz.\n\nKöszönettel,\nSzemesi Pékség HR`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestedFields, setRequestedFields] = useState({
    tax_number: true,
    social_security_number: true,
    mother_name: true,
    bank_account: true
  });

  const handleSend = async () => {
    try {
      setSending(true);
      
      // Create a list of requested fields
      const fields = Object.entries(requestedFields)
        .filter(([_, isRequested]) => isRequested)
        .map(([field]) => {
          switch (field) {
            case 'tax_number': return 'Adóazonosító jel';
            case 'social_security_number': return 'TAJ szám';
            case 'mother_name': return 'Anyja neve';
            case 'bank_account': return 'Bankszámlaszám';
            default: return field;
          }
        });
      
      // Create notification for the employee
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: employee.id,
          title: 'Hiányzó adatok kitöltése',
          message: `Kérjük, töltse ki a következő hiányzó adatokat: ${fields.join(', ')}`,
          type: 'warning',
          priority: 'high',
          read: false,
          action_url: '/profile'
        });
      
      if (notificationError) {
        console.error('Notification error:', notificationError);
        throw new Error('Hiba az értesítés létrehozásakor');
      }
      
      // In a real app, send an email to the employee
      // For demo purposes, we'll just simulate this
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSent(true);
      setTimeout(() => {
        onSent();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Hiba az adatkérés küldésekor:', error);
      toast.error('Hiba az adatkérés küldésekor');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Hiányzó adatok bekérése
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {sent ? (
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Adatkérés elküldve!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Az alkalmazott értesítést kapott a hiányzó adatok kitöltéséről.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Hiányzó adatok bekérése <strong>{employee.full_name}</strong> alkalmazottól.
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                      Az alkalmazott értesítést kap a rendszerben és e-mailt a következő címre: {employee.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bekérendő adatok
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={requestedFields.tax_number}
                        onChange={(e) => setRequestedFields(prev => ({ ...prev, tax_number: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Adóazonosító jel
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={requestedFields.social_security_number}
                        onChange={(e) => setRequestedFields(prev => ({ ...prev, social_security_number: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        TAJ szám
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={requestedFields.mother_name}
                        onChange={(e) => setRequestedFields(prev => ({ ...prev, mother_name: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Anyja neve
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={requestedFields.bank_account}
                        onChange={(e) => setRequestedFields(prev => ({ ...prev, bank_account: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Bankszámlaszám
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Üzenet
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim() || !Object.values(requestedFields).some(v => v)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Küldés...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Küldés
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}