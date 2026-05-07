/**
 * Ensures OrderItems supports package line items (nullable EquipmentId + PackageId).
 * Safe to run on every startup; no-op if already applied.
 */
export async function ensureOrderItemsPackageColumns(db) {
  const pkgCol = await db.request().query(`
    SELECT 1 AS x
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.OrderItems') AND name = N'PackageId'
  `);
  if (!pkgCol.recordset.length) {
    await db.request().query(`
      ALTER TABLE dbo.OrderItems ADD PackageId INT NULL;
    `);
  }

  const eqCol = await db.request().query(`
    SELECT c.is_nullable
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.OrderItems') AND c.name = N'EquipmentId'
  `);
  const row = eqCol.recordset[0];
  const nullable = row?.is_nullable === true || row?.is_nullable === 1;
  if (row && !nullable) {
    await db.request().query(`
      ALTER TABLE dbo.OrderItems ALTER COLUMN EquipmentId INT NULL;
    `);
  }
}
