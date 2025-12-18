#!/bin/bash
# GCP環境構築スクリプト（最小構成）

set -e

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 AdPilot GCP環境構築スクリプト${NC}"
echo "=================================="

# プロジェクトID設定
PROJECT_ID=${GCP_PROJECT_ID:-"adpilot-prod"}
REGION="asia-northeast1"
SERVICE_NAME="adpilot"

echo -e "\n${YELLOW}📋 設定確認${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# 1. gcloud認証確認
echo -e "\n${YELLOW}1. gcloud認証確認${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1; then
  echo -e "${RED}❌ gcloud認証が必要です${NC}"
  echo "実行: gcloud auth login"
  exit 1
fi
echo -e "${GREEN}✅ 認証OK${NC}"

# 2. プロジェクト設定
echo -e "\n${YELLOW}2. プロジェクト設定${NC}"
gcloud config set project $PROJECT_ID 2>/dev/null || {
  echo -e "${YELLOW}プロジェクトを作成します...${NC}"
  gcloud projects create $PROJECT_ID --name="AdPilot Production"
}
echo -e "${GREEN}✅ プロジェクト設定完了${NC}"

# 3. 必要なAPIを有効化
echo -e "\n${YELLOW}3. 必要なAPIを有効化${NC}"
APIs=(
  "run.googleapis.com"
  "cloudbuild.googleapis.com"
  "containerregistry.googleapis.com"
  "secretmanager.googleapis.com"
)

for api in "${APIs[@]}"; do
  echo "  有効化中: $api"
  gcloud services enable $api --quiet
done
echo -e "${GREEN}✅ API有効化完了${NC}"

# 4. Secret Managerで環境変数設定
echo -e "\n${YELLOW}4. 環境変数をSecret Managerに登録${NC}"
echo "以下のコマンドで環境変数を登録してください："
echo ""
echo "# DATABASE_URL"
echo "echo -n 'YOUR_DATABASE_URL' | gcloud secrets create DATABASE_URL --data-file=-"
echo ""
echo "# OPENAI_API_KEY"
echo "echo -n 'YOUR_API_KEY' | gcloud secrets create OPENAI_API_KEY --data-file=-"
echo ""
echo "# CHATWORK_API_TOKEN"
echo "echo -n 'YOUR_TOKEN' | gcloud secrets create CHATWORK_API_TOKEN --data-file=-"
echo ""

# 5. Cloud Buildでデプロイ
echo -e "\n${YELLOW}5. デプロイ${NC}"
echo "以下のコマンドでデプロイできます："
echo ""
echo "gcloud builds submit --config cloudbuild.yaml"
echo ""

echo -e "${GREEN}=================================="
echo "🎉 セットアップ準備完了！"
echo "==================================${NC}"

