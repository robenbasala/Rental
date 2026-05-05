IF OBJECT_ID(N'dbo.RentalPackages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.RentalPackages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(160) NOT NULL,
    SummaryLine NVARCHAR(500) NULL,
    Price DECIMAL(10,2) NOT NULL,
    SortOrder INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END

IF NOT EXISTS (SELECT 1 FROM dbo.RentalPackages)
BEGIN
  INSERT INTO dbo.RentalPackages (Name, SummaryLine, Price, SortOrder, IsActive) VALUES
    (N'Package 1', N'Large bounce + concession', 360.00, 1, 1),
    (N'Package 2', N'Combo unit + concession', 435.00, 2, 1),
    (N'Package 3', N'15ft water slide + concession', 460.00, 3, 1),
    (N'Package 4', N'20ft water slide + concession', 600.00, 4, 1);
END
