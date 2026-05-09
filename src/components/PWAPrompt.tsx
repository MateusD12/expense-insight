import { useState, useEffect } from "react";
import { X, Download, Zap, WifiOff, Shield } from "lucide-react";
import { toast } from "sonner";

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone;

    if (isStandalone || dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 1500);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const fallbackTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast("Como instalar", {
        description:
          "Acesse o menu do navegador e escolha 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="relative bg-gradient-to-br from-[#1a3a6b] to-[#0c1c3a] rounded-2xl shadow-2xl border border-white/10 p-5 w-[300px] overflow-hidden">

        {/* Ambient glows */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-blue-500 rounded-full opacity-[0.08] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-amber-400 rounded-full opacity-[0.08] blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 text-white/25 hover:text-white/60 transition-colors rounded-full"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>

        {/* App header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-[52px] h-[52px] rounded-[14px] overflow-hidden flex-shrink-0 shadow-lg ring-1 ring-white/10">
            <img src="/icon.svg" alt="Expense Insight" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-blue-400 font-bold mb-0.5">
              Disponível para instalar
            </p>
            <h3 className="text-white font-black text-[15px] leading-tight">
              Expense Insight
            </h3>
            <p className="text-white/40 text-[11px] mt-0.5">
              Controle financeiro pessoal
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/[0.07] mb-4" />

        {/* Feature chips */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Zap, label: "Rápido", sub: "Acesso direto" },
            { icon: WifiOff, label: "Offline", sub: "Sem internet" },
            { icon: Shield, label: "Seguro", sub: "Seus dados" },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="bg-white/[0.05] border border-white/[0.06] rounded-xl p-2.5 flex flex-col items-center gap-1.5"
            >
              <Icon size={14} className="text-blue-400" />
              <p className="text-white font-bold text-[10px]">{label}</p>
              <p className="text-white/35 text-[8px] leading-tight text-center">{sub}</p>
            </div>
          ))}
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all text-white font-black text-[13px] h-11 rounded-xl shadow-lg shadow-blue-600/30"
        >
          <Download size={15} />
          Instalar App
        </button>
      </div>
    </div>
  );
}
