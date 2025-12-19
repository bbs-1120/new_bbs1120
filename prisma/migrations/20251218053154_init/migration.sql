-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpn_daily_data" (
    "id" TEXT NOT NULL,
    "cpn_key" TEXT NOT NULL,
    "cpn_name" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "roas" DECIMAL(8,2) NOT NULL,
    "cv" INTEGER NOT NULL DEFAULT 0,
    "mcv" INTEGER NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,2) NOT NULL,
    "cpc" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpn_daily_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judgment_results" (
    "id" TEXT NOT NULL,
    "cpn_key" TEXT NOT NULL,
    "cpn_name" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "judgment_date" DATE NOT NULL,
    "today_profit" DECIMAL(12,2) NOT NULL,
    "profit_7days" DECIMAL(12,2) NOT NULL,
    "roas_7days" DECIMAL(8,2) NOT NULL,
    "consecutive_loss_days" INTEGER NOT NULL,
    "judgment" TEXT NOT NULL,
    "reasons" TEXT[],
    "recommended_action" TEXT NOT NULL,
    "manual_override" TEXT,
    "is_send_target" BOOLEAN NOT NULL DEFAULT false,
    "is_re" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judgment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_by" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_count" INTEGER NOT NULL,
    "rule_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_name_key" ON "media"("name");

-- CreateIndex
CREATE INDEX "cpn_daily_data_cpn_key_idx" ON "cpn_daily_data"("cpn_key");

-- CreateIndex
CREATE INDEX "cpn_daily_data_date_idx" ON "cpn_daily_data"("date");

-- CreateIndex
CREATE INDEX "cpn_daily_data_media_id_idx" ON "cpn_daily_data"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "cpn_daily_data_cpn_key_date_key" ON "cpn_daily_data"("cpn_key", "date");

-- CreateIndex
CREATE INDEX "judgment_results_judgment_date_idx" ON "judgment_results"("judgment_date");

-- CreateIndex
CREATE INDEX "judgment_results_judgment_idx" ON "judgment_results"("judgment");

-- CreateIndex
CREATE UNIQUE INDEX "judgment_results_cpn_key_judgment_date_key" ON "judgment_results"("cpn_key", "judgment_date");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "execution_logs_executed_at_idx" ON "execution_logs"("executed_at");

-- AddForeignKey
ALTER TABLE "cpn_daily_data" ADD CONSTRAINT "cpn_daily_data_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judgment_results" ADD CONSTRAINT "judgment_results_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
