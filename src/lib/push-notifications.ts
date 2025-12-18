// プッシュ通知ユーティリティ

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: string;
    [key: string]: unknown;
  };
}

// Service Worker登録
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// 通知権限リクエスト
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('Notification permission:', permission);
  return permission;
}

// 通知権限チェック
export function getNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

// ローカル通知を送信
export async function sendLocalNotification(payload: PushNotificationPayload): Promise<boolean> {
  const permission = getNotificationPermission();
  
  if (permission !== 'granted') {
    console.log('Notification permission not granted');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/Cactus-Jack.jpg',
      badge: '/icons/Cactus-Jack.jpg',
      tag: payload.tag || 'adpilot-notification',
      requireInteraction: true,
      data: payload.data,
    } as NotificationOptions);

    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

// 異常検知通知
export async function sendAnomalyAlert(
  type: string,
  cpnName: string,
  change: number
): Promise<boolean> {
  const direction = change > 0 ? '📈 急上昇' : '📉 急下降';
  
  return sendLocalNotification({
    title: `${direction} 異常検知`,
    body: `${cpnName}\n変化率: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
    tag: 'anomaly-alert',
    data: {
      url: '/analysis',
      type: 'anomaly',
      cpnName,
      change
    }
  });
}

// エラー通知
export async function sendErrorAlert(
  errorType: string,
  message: string
): Promise<boolean> {
  return sendLocalNotification({
    title: `🚨 ${errorType}`,
    body: message,
    tag: 'error-alert',
    data: {
      url: '/analysis',
      type: 'error'
    }
  });
}

// 利益アラート通知
export async function sendProfitAlert(
  cpnName: string,
  profit: number,
  threshold: number
): Promise<boolean> {
  const isLoss = profit < 0;
  const emoji = isLoss ? '⚠️' : '💰';
  
  return sendLocalNotification({
    title: `${emoji} 利益アラート`,
    body: `${cpnName}\n利益: ¥${profit.toLocaleString()}\n閾値: ¥${threshold.toLocaleString()}`,
    tag: 'profit-alert',
    data: {
      url: '/analysis',
      type: 'profit',
      cpnName,
      profit
    }
  });
}

