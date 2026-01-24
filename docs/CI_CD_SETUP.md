# CI/CD パイプライン設定ガイド

## 概要

このプロジェクトでは GitHub Actions を使用した CI/CD パイプラインが構築されています。

### ワークフロー

1. **CI (ci.yml)**: PRとpush時に型チェック・Lint・ビルドテストを実行
2. **Deploy (deploy.yml)**: mainブランチへのpush時に Cloud Run へ自動デプロイ

---

## 初期セットアップ手順

### 1. GCPサービスアカウントの作成

```bash
# サービスアカウント作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --project=adpilot-prod-1218

# 必要な権限を付与
gcloud projects add-iam-policy-binding adpilot-prod-1218 \
  --member="serviceAccount:github-actions@adpilot-prod-1218.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding adpilot-prod-1218 \
  --member="serviceAccount:github-actions@adpilot-prod-1218.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding adpilot-prod-1218 \
  --member="serviceAccount:github-actions@adpilot-prod-1218.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding adpilot-prod-1218 \
  --member="serviceAccount:github-actions@adpilot-prod-1218.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# サービスアカウントキーを生成
gcloud iam service-accounts keys create ~/github-actions-key.json \
  --iam-account=github-actions@adpilot-prod-1218.iam.gserviceaccount.com
```

### 2. GitHub Secrets の設定

GitHub リポジトリの Settings > Secrets and variables > Actions で以下を設定:

| Secret Name | 値 |
|-------------|-----|
| `GCP_SA_KEY` | 生成したサービスアカウントキー（JSONファイルの中身） |

### 3. 動作確認

```bash
# mainブランチにプッシュすると自動デプロイが実行されます
git push origin main
```

---

## 手動デプロイ

GitHub Actionsを使わず手動でデプロイする場合:

```bash
cd /Users/yutanakata/manji1120
/Users/yutanakata/google-cloud-sdk/bin/gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=adpilot-prod-1218
```

---

## ワークフローの詳細

### CI (ci.yml)
- **トリガー**: PR作成時、mainブランチへのpush時
- **内容**:
  - 依存関係インストール
  - Prisma Client生成
  - TypeScript型チェック
  - ESLint実行
  - Next.jsビルド

### Deploy (deploy.yml)
- **トリガー**: mainブランチへのpush時
- **内容**:
  - Dockerイメージビルド
  - GCRへプッシュ
  - Cloud Runへデプロイ

---

## トラブルシューティング

### デプロイが失敗する場合

1. GitHub Secretsの `GCP_SA_KEY` が正しく設定されているか確認
2. サービスアカウントに必要な権限があるか確認
3. Cloud Run のサービスURLにアクセスしてエラーログを確認

### ビルドが失敗する場合

1. ローカルで `npm run build` が成功するか確認
2. TypeScript エラーがないか確認
3. 環境変数が正しく設定されているか確認

---

## 本番URL

https://adpilot-311489166272.asia-northeast1.run.app

