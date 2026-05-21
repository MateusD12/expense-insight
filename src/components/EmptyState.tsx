import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, iconClassName, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center",
        iconClassName ?? "bg-slate-100"
      )}>
        <Icon size={26} className="text-slate-400" />
      </div>
      <div className="space-y-1">
        <p className="font-black text-slate-700 text-sm">{title}</p>
        <p className="text-xs text-slate-400 max-w-[220px]">{description}</p>
      </div>
      {action}
    </div>
  );
}
