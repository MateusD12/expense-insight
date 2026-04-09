import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TableProperties, BarChart3 } from "lucide-react";

const links = [
  { to: "/planilha", label: "Planilha", icon: TableProperties },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <span className="font-bold text-foreground text-lg">💳 Controle de Gastos</span>
          <nav className="flex gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
