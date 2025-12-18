"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle, AlertCircle, Smartphone } from "lucide-react";
import { Button } from "./button";
import { 
  registerServiceWorker, 
  requestNotificationPermission, 
  getNotificationPermission,
  sendLocalNotification 
} from "@/lib/push-notifications";

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lineConfigured, setLineConfigured] = useState(false);

  useEffect(() => {
    // 初期状態チェック
    const checkStatus = async () => {
      setPermission(getNotificationPermission());
      
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        setIsRegistered(!!reg);
      }

      // LINE設定確認
      try {
        const res = await fetch('/api/line');
        const data = await res.json();
        setLineConfigured(data.configured);
      } catch {
        setLineConfigured(false);
      }
    };
    
    checkStatus();
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      // Service Worker登録
      await registerServiceWorker();
      setIsRegistered(true);

      // 通知権限リクエスト
      const perm = await requestNotificationPermission();
      setPermission(perm);

      if (perm === 'granted') {
        // テスト通知
        await sendLocalNotification({
          title: '🔔 通知が有効になりました',
          body: 'AdPilotからの通知を受け取れるようになりました',
          data: { url: '/analysis' }
        });
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    await sendLocalNotification({
      title: '📊 テスト通知',
      body: 'これはAdPilotからのテスト通知です',
      data: { url: '/analysis' }
    });
  };

  const handleTestLineNotification = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' })
      });
      const data = await res.json();
      alert(data.success ? 'LINE通知送信成功！' : 'LINE通知送信失敗');
    } catch {
      alert('LINE通知送信エラー');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5" />
        通知設定
      </h3>

      <div className="space-y-4">
        {/* プッシュ通知 */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-500" />
              <span className="font-medium text-slate-900 dark:text-white">プッシュ通知</span>
            </div>
            {permission === 'granted' ? (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                有効
              </span>
            ) : permission === 'denied' ? (
              <span className="flex items-center gap-1 text-red-500 text-sm">
                <BellOff className="h-4 w-4" />
                拒否
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                未設定
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            異常検知やエラー発生時にスマホに通知が届きます
          </p>

          <div className="flex gap-2">
            {permission !== 'granted' ? (
              <Button 
                onClick={handleEnableNotifications} 
                loading={loading}
                size="sm"
              >
                通知を有効にする
              </Button>
            ) : (
              <Button 
                onClick={handleTestNotification}
                variant="secondary"
                size="sm"
              >
                テスト通知
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <p className="text-xs text-red-500 mt-2">
              ブラウザの設定から通知を許可してください
            </p>
          )}
        </div>

        {/* LINE通知 */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .195-.097.364-.236.49l-.002.001-3.42 2.58.002-.001 1.55 5.126c.047.156.072.31.072.455 0 .35-.284.632-.63.632-.127 0-.254-.032-.37-.103l-4.96-3.21-4.962 3.21c-.116.071-.243.103-.37.103-.345 0-.63-.282-.63-.632 0-.145.025-.299.072-.455l1.55-5.126-3.42-2.58-.002.001c-.139-.126-.236-.295-.236-.49 0-.346.282-.631.63-.631h4.22l1.544-5.076c.08-.262.324-.44.607-.44.282 0 .528.178.607.44l1.544 5.076h4.22z"/>
              </svg>
              <span className="font-medium text-slate-900 dark:text-white">LINE通知</span>
            </div>
            {lineConfigured ? (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                設定済み
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                未設定
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            エラー発生時にLINEに通知が届きます
          </p>

          {lineConfigured ? (
            <Button 
              onClick={handleTestLineNotification}
              variant="secondary"
              size="sm"
              loading={loading}
            >
              テスト送信
            </Button>
          ) : (
            <p className="text-xs text-slate-500">
              LINE_NOTIFY_TOKENを設定してください
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

