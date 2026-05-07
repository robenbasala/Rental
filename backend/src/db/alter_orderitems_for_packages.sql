-- Run once on existing databases to support package items in invoices/orders.

IF COL_LENGTH('dbo.OrderItems', 'PackageId') IS NULL
BEGIN
  ALTER TABLE dbo.OrderItems ADD PackageId INT NULL;
END

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.OrderItems')
    AND name = N'EquipmentId'
    AND is_nullable = 0
)
BEGIN
  ALTER TABLE dbo.OrderItems ALTER COLUMN EquipmentId INT NULL;
END
