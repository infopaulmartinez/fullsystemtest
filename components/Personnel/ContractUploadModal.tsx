import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Send, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { sendContractSigningEmail } from '../../lib/emailService';

interface ContractUploadModalProps {
  employee: {
    id: string;
    full_name: string;
    email: string;
  };
  onClose: () => void;
  onUploaded: () => void;
}

export default function ContractUploadModal({ employee, onClose, onUploaded }: ContractUploadModalProps) {
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Csak PDF vagy Word dokumentumok engedélyezettek');
        return;
      }
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('A fájl mérete nem lehet nagyobb 10MB-nál');
        return;
      }
      
      setContractFile(file);
    }
  };

  const handleUpload = async () => {
    if (!contractFile) {
      toast.error('Kérjük, válasszon feltöltendő fájlt');
      return;
    }
    
    try {
      setUploading(true);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 200);
      
      // In a real app, upload the file to Supabase Storage
      const fileExt = contractFile.name.split('.').pop();
      const fileName = `contract-${employee.id}-${Date.now()}.${fileExt}`;
      const filePath = `contracts/${fileName}`;
      
      // Simulate file upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create document record in the database
      const contractData = {
        name: `${employee.full_name} munkaszerződése`,
        type: 'contract',
        category: 'HR',
        file_path: filePath,
        file_size: contractFile.size,
        mime_type: contractFile.type,
        description: `${employee.full_name} munkaszerződése (${new Date().toLocaleDateString('hu-HU')})`,
        status: 'pending',
        employee_id: employee.id,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        created_at: new Date().toISOString()
      };
      
      // In a real app, insert into database
      // For demo purposes, we'll just simulate this
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send email to employee
      await sendContractSigningEmail(employee.email, contractData.name);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploaded(true);
      
      toast.success('Szerződés sikeresen feltöltve és elküldve aláírásra!');
      
      // Close modal after a delay
      setTimeout(() => {
        onUploaded();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Hiba a szerződés feltöltésekor:', error);
      toast.error('Hiba történt a szerződés feltöltésekor!');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Munkaszerződés feltöltése
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {uploaded ? (
            <div className="text-center py-6">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Szerződés feltöltve!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                A szerződés sikeresen feltöltve és elküldve aláírásra.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Munkaszerződés feltöltése és küldése <strong>{employee.full_name}</strong> részére.
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  {contractFile ? (
                    <div className="space-y-2">
                      <FileText className="h-10 w-10 text-blue-500 mx-auto" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{contractFile.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(contractFile.size / 1024).toFixed(2)} KB
                      </p>
                      <button
                        onClick={() => setContractFile(null)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Eltávolítás
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Kattintson vagy húzza ide a fájlt a feltöltéshez
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF, DOCX (max. 10MB)
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileChange}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Fájl kiválasztása
                      </button>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">Feltöltés</span>
                      <span className="text-gray-700 dark:text-gray-300">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    A feltöltés után a rendszer automatikusan elküldi a szerződést aláírásra a következő email címre:
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {employee.email}
                  </p>
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !!contractFile}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Fájl kiválasztása
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !contractFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Feltöltés...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Küldés aláírásra
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