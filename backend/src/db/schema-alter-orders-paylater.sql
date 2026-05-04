/* Run once on existing databases */
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'PayLater'
)
BEGIN
  ALTER TABLE dbo.Orders ADD PayLater BIT NOT NULL CONSTRAINT DF_Orders_PayLater DEFAULT (0);
END
GO
