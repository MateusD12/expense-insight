import { useState, useEffect } from "react";
import { X, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "pwa-prompt-dismissed";

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadyDismissed = sessionStorage.getItem(DISMISS_KEY);
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (alreadyDismissed || isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => setVisible(true), 800);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast("Como instalar o app", {
        description:
          "No menu do navegador, toque em 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
        duration: 6000,
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  const features = [
    "Acesso instantâneo na tela inicial",
    "Funciona mesmo sem internet",
    "Seguro e sempre atualizado",
  ];

  return (
    <>
      {/* Backdrop blur for mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
        onClick={dismiss}
      />

      <div className="fixed z-50 bottom-0 left-0 right-0 sm:bottom-5 sm:right-5 sm:left-auto sm:w-[368px] animate-in slide-in-from-bottom-8 duration-500 ease-out">
        <div className="relative bg-[#08112b] rounded-t-[28px] sm:rounded-[24px] overflow-hidden border-t border-x sm:border border-white/[0.08] shadow-[0_-8px_48px_rgba(0,0,0,0.5)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

          {/* Top drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-9 h-1 rounded-full bg-white/20" />
          </div>

          {/* Decorative gradients */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-blue-600 opacity-[0.12] blur-3xl" />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-indigo-500 opacity-[0.10] blur-3xl" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
          </div>

          <div className="relative p-6 pt-4 sm:pt-6">

            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>

            {/* App identity */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative flex-shrink-0">
                <div className="w-[68px] h-[68px] rounded-[18px] overflow-hidden shadow-[0_8px_24px_rgba(37,99,235,0.35)] ring-1 ring-white/10">
                  <img
                    src="/icon.svg"
                    alt="Expense Insight"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg ring-2 ring-[#08112b]">
                  <Download size={10} className="text-white" strokeWidth={3} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-blue-400 mb-1">
                  Disponível para instalar
                </p>
                <h2 className="text-white font-black text-[18px] leading-none tracking-tight mb-2">
                  Expense Insight
                </h2>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="11" height="11" viewBox="0 0 12 12">
                      <path
                        d="M6 1l1.4 3h3.2l-2.6 1.9 1 3L6 7.3 2.9 8.9l1-3L1.4 4H4.6z"
                        fill={i < 5 ? "#f59e0b" : "#ffffff20"}
                      />
                    </svg>
                  ))}
                  <span className="text-white/30 text-[10px] ml-0.5">• Grátis</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />

            {/* Features */}
            <div className="space-y-3 mb-6">
              {features.map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <CheckCircle2
                    size={16}
                    className="text-blue-400 flex-shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="text-white/65 text-[13px] leading-snug">{text}</span>
                </div>
              ))}
            </div>

            {/* Install button */}
            <button
              onClick={handleInstall}
              className="group relative w-full h-[50px] rounded-[14px] overflow-hidden font-black text-[14px] text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] mb-3"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
                boxShadow: "0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
              />
              <Download size={17} strokeWidth={2.5} className="relative z-10" />
              <span className="relative z-10">Instalar Gratuitamente</span>
            </button>

            {/* Dismiss link */}
            <button
              onClick={dismiss}
              className="w-full text-center text-white/25 hover:text-white/50 text-[12px] transition-colors py-0.5"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
