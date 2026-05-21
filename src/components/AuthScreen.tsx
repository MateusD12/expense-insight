import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Chrome } from "lucide-react";
import { toast } from "sonner";

export function AuthScreen() {
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

  const loginWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success("Verifique seu e-mail!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}?mode=reset`,
      });
      if (error) throw error;
      toast.success("Link de recuperação enviado! Verifique seu e-mail.");
      setAuthMode("login");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-10 text-center text-white">
          <Wallet size={48} className="mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-tighter">Financeiro</h1>
        </div>
        <div className="p-8 space-y-6">
          <Button
            onClick={loginWithGoogle}
            variant="outline"
            className="w-full h-12 font-bold flex gap-3 text-slate-700 hover:bg-slate-50"
          >
            <Chrome size={20} className="text-blue-500" /> Entrar com Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-400">
              <span className="bg-white px-2">Ou E-mail</span>
            </div>
          </div>

          {authMode === "recovery" ? (
            <form onSubmit={handleRecovery} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail cadastrado"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="h-12 border-slate-200"
              />
              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700 uppercase tracking-widest transition-colors"
              >
                Enviar link de recuperação
              </Button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="w-full text-xs text-slate-500 hover:text-slate-700 font-bold"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="h-12 border-slate-200"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="h-12 border-slate-200"
              />
              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700 uppercase tracking-widest transition-colors"
              >
                {authMode === "login" ? "Entrar" : "Cadastrar"}
              </Button>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                  className="hover:text-slate-700"
                >
                  {authMode === "login" ? "Criar conta" : "Já tenho conta"}
                </button>
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => setAuthMode("recovery")}
                    className="hover:text-slate-700"
                  >
                    Esqueci a senha
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
