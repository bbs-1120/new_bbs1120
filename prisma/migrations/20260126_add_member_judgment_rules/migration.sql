-- CreateTable
CREATE TABLE "member_judgment_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_judgment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_judgment_rules_user_id_is_active_idx" ON "member_judgment_rules"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "member_judgment_rules_rule_type_idx" ON "member_judgment_rules"("rule_type");
