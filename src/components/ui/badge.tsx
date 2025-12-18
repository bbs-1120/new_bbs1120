import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "stop" | "replace" | "continue" | "check";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    stop: "bg-red-100 text-red-700",
    replace: "bg-orange-100 text-orange-700",
    continue: "bg-green-100 text-green-700",
    check: "bg-yellow-100 text-yellow-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function JudgmentBadge({ judgment }: { judgment: string }) {
  const getVariant = (): BadgeProps["variant"] => {
    switch (judgment) {
      case "停止":
        return "stop";
      case "作り替え":
        return "replace";
      case "継続":
        return "continue";
      case "要確認":
        return "check";
      default:
        return "default";
    }
  };

  return <Badge variant={getVariant()}>{judgment}</Badge>;
}

