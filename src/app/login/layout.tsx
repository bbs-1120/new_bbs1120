import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "ログイン - GrowthDeck",
  description: "GrowthDeckにログイン",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
