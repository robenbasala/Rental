import { getDb } from "../src/config/db.js";

const db = await getDb();

await db.request().query(`
IF COL_LENGTH('dbo.Settings', 'DeliveryFixedFee') IS NULL
BEGIN
  ALTER TABLE dbo.Settings
  ADD DeliveryFixedFee DECIMAL(10,2) NOT NULL DEFAULT 0;
END
`);

console.log("DeliveryFixedFee column is ready.");
