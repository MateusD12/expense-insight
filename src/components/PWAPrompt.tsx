import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex justify-end animate-in slide-in-from-bottom-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-[320px] max-w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
            <Download size={24} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-slate-800 text-sm">Instalar App</h3>
            <p className="text-xs text-slate-500 font-medium">Acesso rápido e offline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleInstallClick} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs h-9 rounded-xl px-4"
          >
            Baixar
          </Button>
          <button 
            onClick={handleClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
