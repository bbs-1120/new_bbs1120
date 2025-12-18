import { Search, Bell, HelpCircle } from "lucide-react";
import { RealtimeClock } from "@/components/ui/realtime-clock";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="mb-4 lg:mb-6">
      {/* トップバー - デスクトップのみ表示 */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm w-80">
            <Search className="h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="検索..." 
              className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
              ⌘K
            </kbd>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeClock />
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#e01e5a] rounded-full"></span>
          </button>
        </div>
      </div>

      {/* タイトル */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && (
            <p className="text-xs lg:text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </header>
  );
}
