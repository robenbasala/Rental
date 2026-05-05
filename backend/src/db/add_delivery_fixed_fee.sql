-- Run once on existing databases (fresh installs: use schema.sql)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Settings') AND name = N'DeliveryFixedFee'
)
BEGIN
  ALTER TABLE dbo.Settings ADD DeliveryFixedFee DECIMAL(10,2) NOT NULL DEFAULT 0;
END
