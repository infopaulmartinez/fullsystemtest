import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Check, Pen, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface ContractSigningModalProps {
  contractId: string;
  employeeName: string;
  onClose: () => void;
  onSigned: () => void;
}

export default function ContractSigningModal({ contractId, employeeName, onClose, onSigned }: ContractSigningModalProps) {
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadContract();
  }, [contractId]);

  useEffect(() => {
    if (showSignaturePad && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'black';
      }
    }
  }, [showSignaturePad]);

  const loadContract = async () => {
    try {
      setLoading(true);
      
      // In a real app, fetch the contract from the database
      // For demo purposes, we'll use mock data
      const mockContract = {
        id: contractId,
        name: `${employeeName} munkaszerződése`,
        content: `
          <h1>MUNKASZERZŐDÉS</h1>
          <p>Amely létrejött egyrészről a</p>
          <p><strong>Szemesi Pékség Kft.</strong> (székhely: 8636 Balatonszemes, Fő u. 12., adószám: 12345678-1-42, cégjegyzékszám: 01-09-123456, képviseli: Nagy Péter ügyvezető), mint munkáltató (a továbbiakban: Munkáltató),</p>
          <p>másrészről</p>
          <p><strong>${employeeName}</strong> (születési hely, idő: ..., anyja neve: ..., lakcím: ..., adóazonosító jel: ..., TAJ szám: ...), mint munkavállaló (a továbbiakban: Munkavállaló)</p>
          <p>között az alábbi feltételekkel:</p>
          
          <h2>1. A munkaviszony kezdete</h2>
          <p>A munkaviszony kezdete: ${new Date().toISOString().split('T')[0]}</p>
          <p>A munkaviszony határozatlan időre jön létre.</p>
          
          <h2>2. Munkakör</h2>
          <p>A Munkavállaló munkaköre: Pék</p>
          <p>A munkakörbe tartozó feladatok: péksütemények, kenyerek és egyéb pékáruk készítése, a gyártási folyamatok felügyelete, minőségellenőrzés.</p>
          
          <h2>3. Munkavégzés helye</h2>
          <p>A munkavégzés helye: 8636 Balatonszemes, Fő u. 12.</p>
          
          <h2>4. Munkaidő</h2>
          <p>A munkavállaló heti 40 órás, teljes munkaidőben kerül foglalkoztatásra.</p>
          
          <h2>5. Bérezés</h2>
          <p>A Munkavállaló alapbére: 2500 Ft/óra</p>
          <p>A munkabér kifizetése havonta, a tárgyhót követő hónap 10. napjáig történik, a Munkavállaló bankszámlájára való átutalással.</p>
          
          <h2>6. Szabadság</h2>
          <p>A Munkavállalót a Munka Törvénykönyve szerinti szabadság illeti meg.</p>
          
          <h2>7. Felmondási idő</h2>
          <p>A munkaviszony felmondása esetén a Munka Törvénykönyve szerinti felmondási idő az irányadó.</p>
          
          <h2>8. Egyéb rendelkezések</h2>
          <p>A jelen szerződésben nem szabályozott kérdésekben a Munka Törvénykönyve és a kapcsolódó jogszabályok rendelkezései az irányadóak.</p>
          
          <p>Jelen szerződést a felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag aláírták.</p>
          
          <p>Kelt: Balatonszemes, ${new Date().toISOString().split('T')[0]}</p>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div>
              <p>____________________________</p>
              <p>Munkáltató</p>
            </div>
            <div>
              <p>____________________________</p>
              <p>Munkavállaló</p>
            </div>
          </div>
        `,
        file_path: '/contracts/contract.pdf',
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      setContract(mockContract);
    } catch (error) {
      console.error('Hiba a szerződés betöltésekor:', error);
      toast.error('Hiba a szerződés betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setLastPosition({ x, y });
  };

  const handleDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      e.preventDefault(); // Prevent scrolling on touch devices
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setLastPosition({ x, y });
  };

  const handleEndDrawing = () => {
    setIsDrawing(false);
    
    // Save the signature data
    if (canvasRef.current) {
      const signatureData = canvasRef.current.toDataURL('image/png');
      setSignatureData(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const handleSignContract = async () => {
    if (!signatureData) {
      toast.error('Kérjük, írja alá a szerződést');
      return;
    }
    
    try {
      setSigning(true);
      
      // In a real app, save the signature and update the contract status
      // For demo purposes, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Szerződés sikeresen aláírva!');
      onSigned();
      onClose();
    } catch (error) {
      console.error('Hiba a szerződés aláírásakor:', error);
      toast.error('Hiba a szerződés aláírásakor');
    } finally {
      setSigning(false);
    }
  };

  const downloadContract = () => {
    // In a real app, this would download the actual contract
    toast.success('Szerződés letöltése folyamatban...');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {contract.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {showSignaturePad ? (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Kérjük, írja alá a szerződést az alábbi mezőben. Az aláírás után a szerződés érvénybe lép.
                </p>
              </div>
              
              <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-2">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full bg-white touch-none"
                  onMouseDown={handleStartDrawing}
                  onMouseMove={handleDrawing}
                  onMouseUp={handleEndDrawing}
                  onMouseLeave={handleEndDrawing}
                  onTouchStart={handleStartDrawing}
                  onTouchMove={handleDrawing}
                  onTouchEnd={handleEndDrawing}
                ></canvas>
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={clearSignature}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Törlés
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => setShowSignaturePad(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Vissza
                  </button>
                  <button
                    onClick={handleSignContract}
                    disabled={!signatureData || signing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {signing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Aláírás...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Aláírás
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Contract Content */}
              <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6 mb-6">
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: contract.content }}
                ></div>
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={downloadContract}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Letöltés
                </button>
                <button
                  onClick={() => setShowSignaturePad(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Pen className="h-4 w-4 mr-2" />
                  Aláírás
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}