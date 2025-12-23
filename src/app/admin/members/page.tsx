"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw,
  Shield,
  User,
  X
} from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  role: string;
  teamName: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  inviteUrl?: string;
}

interface UserData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  teamName: string | null;
  createdAt: string;
}

export default function AdminMembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member",
    teamName: "",
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 認証チェック
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    if (session.user.role !== "admin") {
      router.push("/");
      return;
    }
    fetchData();
  }, [session, status, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/invite");
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
        setInvites(data.invites || []);
      }
    } catch {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email) {
      setError("メールアドレスを入力してください");
      return;
    }

    setInviteLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });

      const data = await response.json();

      if (data.success) {
        setNewInviteUrl(data.invite.inviteUrl);
        setInvites([data.invite, ...invites]);
        setInviteForm({ email: "", role: "member", teamName: "" });
      } else {
        setError(data.error || "招待の作成に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm("この招待を削除しますか？")) return;

    try {
      const response = await fetch(`/api/admin/invite?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setInvites(invites.filter((inv) => inv.id !== id));
      }
    } catch {
      console.error("Failed to delete invite");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-4">
          <Header title="メンバー管理" description="チームメンバーの招待と管理" />
        </div>
        <div className="container mx-auto px-4 pb-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-4">
        <Header title="メンバー管理" description="チームメンバーの招待と管理" />
      </div>
      <div className="container mx-auto px-4 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            <span className="text-lg font-semibold text-slate-700">メンバー一覧</span>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            メンバーを招待
          </Button>
        </div>

        {/* メンバー一覧 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              登録メンバー（{users.length}人）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                まだメンバーが登録されていません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">名前</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">メール</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">担当者名</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">権限</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">登録日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{user.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{user.email}</td>
                        <td className="px-4 py-3">
                          {user.teamName ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              {user.teamName}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.role === "admin" ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Shield className="h-4 w-4" />
                              管理者
                            </span>
                          ) : (
                            <span className="text-slate-600">メンバー</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-sm">
                          {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 招待一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              招待中（{invites.filter(i => !i.usedAt).length}件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                招待はありません
              </p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className={`p-4 rounded-lg border ${
                      invite.usedAt
                        ? "bg-slate-50 border-slate-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {invite.teamName && (
                            <span className="text-blue-600">担当: {invite.teamName}</span>
                          )}
                          <span>
                            期限: {new Date(invite.expiresAt).toLocaleDateString("ja-JP")}
                          </span>
                          {invite.usedAt && (
                            <span className="text-green-600">✓ 登録済み</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!invite.usedAt && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteInvite(invite.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 招待モーダル */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">メンバーを招待</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setNewInviteUrl(null);
                  setError(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {newInviteUrl ? (
                <>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-700 font-medium mb-2">招待を作成しました！</p>
                    <p className="text-sm text-green-600 mb-3">
                      以下のURLをメンバーに送信してください
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newInviteUrl}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(newInviteUrl)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setShowInviteModal(false);
                      setNewInviteUrl(null);
                    }}
                  >
                    閉じる
                  </Button>
                </>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      メールアドレス *
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="example@shibuya-ad.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      担当者名（CPN照合用）
                    </label>
                    <select
                      value={inviteForm.teamName}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, teamName: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">選択してください</option>
                      <option value="悠太">悠太</option>
                      <option value="祐輝">祐輝</option>
                      <option value="圭市">圭市</option>
                      <option value="正弥">正弥</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      「新規グロース部_{"{担当者名}"}_」のCPNが表示されます
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      権限
                    </label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, role: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="member">メンバー（自分のCPNのみ）</option>
                      <option value="admin">管理者（全CPN閲覧可）</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setShowInviteModal(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleInvite}
                      disabled={inviteLoading}
                    >
                      {inviteLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          作成中...
                        </>
                      ) : (
                        "招待を作成"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

