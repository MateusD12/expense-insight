import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
// ... (mantenha todos os outros imports iguais aos anteriores)

export default function Index() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ESTADOS DE AUTH E FORMULÁRIO (Mantenha os que já tínhamos)
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

  useEffect(() => {
    // Inteligência para limpar a URL após o login do Google e detectar a sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      // Se tiver token na URL (erro do localhost), limpa a barra de endereço
      if (window.location.hash || window.location.search.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FUNÇÕES DE AUTH ---
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin, // Garante que ele volte para o Lovable e não localhost
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info("Até logo!");
  };

  // --- LÓGICA DE GASTOS ---
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();

  // Função ajustada para salvar com o ID do usuário logado
  const handleSaveExpense = (data: any) => {
    if (!session?.user?.id) return toast.error("Usuário não identificado.");

    const faturaSegura = data.fatura && data.fatura.length === 7 ? `${data.fatura}-01` : data.fatura;

    const payload = {
      ...data,
      valor: Number(data.valor),
      parcela: Number(data.parcela),
      total_parcela: Number(data.total_parcela),
      fatura: faturaSegura,
      user_id: session.user.id, // Aqui o gasto ganha o "dono"
    };

    if (editing) {
      updateExpense.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Atualizado!");
            setFormOpen(false);
          },
        },
      );
    } else {
      addExpense.mutate(payload, {
        onSuccess: () => {
          toast.success("Adicionado!");
          setFormOpen(false);
        },
      });
    }
  };

  // ... (Mantenha todo o restante do JSX, tabelas e gráficos que já estavam funcionando perfeitamente)

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-500 font-mono italic">
        Validando acesso...
      </div>
    );

  if (!session) {
    return (
      // Retorne aqui aquele bloco da TELA DE LOGIN que mandei antes (com Google, Email, etc)
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        {/* ... código da tela de login ... */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">{/* Mantenha o Dashboard completo que já estava lindão */}</div>
  );
}
