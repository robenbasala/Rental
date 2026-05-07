/**
 * True if dbo.Orders has PayLater column (older DBs need schema-alter-orders-paylater.sql).
 */
export async function ordersTableHasPayLater(db) {
  const r = await db.request().query(`
    SELECT 1 AS x
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'PayLater'
  `);
  return r.recordset.length > 0;
}

/**
 * True if dbo.OrderItems has PackageId column (for package line items).
 */
export async function orderItemsTableHasPackageId(db) {
  const r = await db.request().query(`
    SELECT 1 AS x
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.OrderItems') AND name = N'PackageId'
  `);
  return r.recordset.length > 0;
}
