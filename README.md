# CPN自動仕分けシステム

広告運用データをCPN単位で自動仕分けし、日次の運用判断を効率化するシステム。

## 概要

スプレッドシートに集約された広告運用データをもとに、CPN単位で「停止／作り替え／継続／要確認」を自動仕分けし、Chatworkへ通知します。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 15 (App Router) |
| スタイリング | Tailwind CSS |
| ORM | Prisma |
| データベース | PostgreSQL |
| 外部連携 | Google Sheets API |
| 通知 | Chatwork API |
| 言語 | TypeScript |
| 本番環境 | Google Cloud (Cloud Run / Cloud SQL) |

## 対象媒体

- Meta
- TikTok
- YouTube
- Pangle
- LINE

## 機能

- **ダッシュボード**: 仕分け結果のサマリー表示
- **仕分け結果一覧**: CPNの一覧表示、フィルタ、検索
- **データ同期**: スプレッドシートからDBへのデータ同期
- **Chatwork送信**: 仕分け結果のChatwork通知
- **設定**: 仕分けルール、API連携の設定
- **実行履歴**: 操作ログの確認

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを編集して必要な値を設定:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/cpn_sorting?schema=public"

# Google Sheets API
GOOGLE_SHEETS_PRIVATE_KEY=""
GOOGLE_SHEETS_CLIENT_EMAIL=""
GOOGLE_SHEETS_SPREADSHEET_ID=""

# Chatwork API
CHATWORK_API_TOKEN=""
CHATWORK_ROOM_ID=""
```

### 3. データベースのセットアップ

```bash
# PostgreSQLを起動してDBを作成後
npx prisma migrate dev
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

## ドキュメント

- [要件定義書](./docs/requirements.md)

## 仕分けロジック

### 判定優先順位
```
停止 ＞ 作り替え ＞ 継続 ＞ 要確認
```

### 停止条件（Reあり CPN）
- 連続赤字日数 ≥ 2日
- 直近7日間赤字額 ≥ 40,000円
- 直近7日間ROAS < 105%

### 作り替え条件（Reなし CPN）
- 連続赤字日数 ≥ 3日
- 直近7日間赤字額 ≥ 40,000円
- 直近7日間ROAS < 105%

### 継続条件
- 直近7日間利益 > 0
- 当日利益 > 0
- 直近7日間ROAS ≥ 110%

## ライセンス

Private
