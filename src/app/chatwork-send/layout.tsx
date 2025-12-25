import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";

export default function ChatworkSendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
          <div className="p-4 lg:p-6">
            <Header
              title="Chatwork送信管理"
              description="送信するCPNを選択・編集してChatworkに送信"
            />
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}

