import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#007a5a] hover:bg-[#148567] active:bg-[#0a5c43] text-white shadow-sm focus:ring-[#007a5a]",
    secondary: "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm focus:ring-slate-400",
    danger: "bg-[#e01e5a] hover:bg-[#c91c51] active:bg-[#a91745] text-white shadow-sm focus:ring-[#e01e5a]",
    ghost: "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600",
    success: "bg-[#2eb67d] hover:bg-[#28a370] active:bg-[#228f62] text-white shadow-sm focus:ring-[#2eb67d]",
  };
  
  const sizes = {
    sm: "h-7 px-3 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-6 text-base gap-2.5",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        loading && "cursor-wait",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin h-4 w-4" />}
      {children}
    </button>
  );
}
