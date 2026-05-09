import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { toast } from "sonner";

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (!isStandalone) {
      // Mostra o prompt após 2.5 segundos para garantir que o usuário veja a opção
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);

      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
      };

      window.addEventListener("beforeinstallprompt", handler);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Caso o evento beforeinstallprompt não tenha sido capturado (ex: iOS ou navegadores restritos)
      toast("Instrução de Instalação", {
        description: "Para instalar, acesse o menu do seu navegador e escolha 'Adicionar à Tela Inicial' ou 'Instalar Aplicativo'.",
      });
      return;
    }
    // Mostra o prompt nativo de instalação
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-sm flex items-center justify-between gap-4 mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
            <Download size={24} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-slate-800 text-[15px]">Instalar App</h3>
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
