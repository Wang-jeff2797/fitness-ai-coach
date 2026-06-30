-- ============================================================
-- 迁移 v5: 个人纪录自动计算字段
-- 新增: personal_records.calculated_1rm
-- ============================================================
ALTER TABLE personal_records ADD COLUMN IF NOT EXISTS calculated_1rm DECIMAL(8,2) DEFAULT 0;
