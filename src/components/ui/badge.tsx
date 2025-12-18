import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export function Badge({
  className,
  variant = "default",
  size = "sm",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]",
    warning: "bg-[#fff8e1] text-[#f57f17] border-[#ffecb3]",
    danger: "bg-[#ffebee] text-[#c62828] border-[#ffcdd2]",
    info: "bg-[#e3f2fd] text-[#1565c0] border-[#bbdefb]",
    purple: "bg-[#f3e5f5] text-[#6a1b9a] border-[#e1bee7]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// 判定結果用バッジ
export function JudgmentBadge({ judgment }: { judgment: string }) {
  const config: Record<string, { variant: BadgeProps["variant"]; icon: string }> = {
    停止: { variant: "danger", icon: "🛑" },
    作り替え: { variant: "warning", icon: "🔄" },
    継続: { variant: "success", icon: "✅" },
    要確認: { variant: "purple", icon: "❓" },
    エラー: { variant: "danger", icon: "⚠️" },
  };

  const { variant, icon } = config[judgment] || { variant: "default", icon: "📋" };

  return (
    <Badge variant={variant} size="md" className="gap-1">
      <span>{icon}</span>
      {judgment}
    </Badge>
  );
}

// メディアバッジ
export function MediaBadge({ media }: { media: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    Meta: { bg: "bg-blue-50", text: "text-blue-700", icon: "📘" },
    TikTok: { bg: "bg-pink-50", text: "text-pink-700", icon: "🎵" },
    Pangle: { bg: "bg-orange-50", text: "text-orange-700", icon: "🔶" },
    YouTube: { bg: "bg-red-50", text: "text-red-700", icon: "▶️" },
    LINE: { bg: "bg-green-50", text: "text-green-700", icon: "💬" },
  };

  const { bg, text, icon } = config[media] || { bg: "bg-slate-50", text: "text-slate-700", icon: "📱" };

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", bg, text)}>
      <span>{icon}</span>
      {media}
    </span>
  );
}
