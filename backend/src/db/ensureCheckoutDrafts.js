/**
 * Stores checkout payload until Stripe payment succeeds (no order row until webhook).
 */
export async function ensureCheckoutDraftsTable(db) {
  await db.request().query(`
    IF OBJECT_ID(N'dbo.CheckoutDrafts', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.CheckoutDrafts (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        Payload NVARCHAR(MAX) NOT NULL,
        ConsumedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2 NOT NULL
      );
      CREATE INDEX IX_CheckoutDrafts_UserExpires ON dbo.CheckoutDrafts (UserId, ExpiresAt);
    END
  `);
}
