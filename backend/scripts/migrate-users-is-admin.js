/**
 * Adds Users.IsAdmin, migrates AdminUsers → Users, repoints AdminNotes FK, drops AdminUsers.
 * Usage: node scripts/migrate-users-is-admin.js
 */
import { getDb } from "../src/config/db.js";

const db = await getDb();

await db.request().query(`
IF COL_LENGTH('dbo.Users', 'IsAdmin') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD IsAdmin BIT NOT NULL CONSTRAINT DF_Users_IsAdmin DEFAULT 0;
END
`);

const adminUsersExists = await db.request().query(`
  SELECT CASE WHEN OBJECT_ID('dbo.AdminUsers', 'U') IS NOT NULL THEN 1 ELSE 0 END AS X
`);
if (adminUsersExists.recordset[0]?.X === 1) {
  await db.request().query(`
    INSERT INTO dbo.Users (Name, Email, Phone, PasswordHash, IsAdmin, IsActive)
    SELECT au.Name, au.Email, NULL, au.PasswordHash, 1, au.IsActive
    FROM dbo.AdminUsers au
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.Email = au.Email)
  `);

  await db.request().query(`
    UPDATE u
    SET u.IsAdmin = 1,
        u.PasswordHash = au.PasswordHash,
        u.IsActive = au.IsActive,
        u.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.Users u
    INNER JOIN dbo.AdminUsers au ON au.Email = u.Email
  `);

  await db.request().query(`
    UPDATE an
    SET an.AdminUserId = u.Id
    FROM dbo.AdminNotes an
    INNER JOIN dbo.AdminUsers au ON au.Id = an.AdminUserId
    INNER JOIN dbo.Users u ON u.Email = au.Email
  `);

  const fks = await db.request().query(`
    SELECT fk.name AS FkName, OBJECT_NAME(fk.referenced_object_id) AS RefTable
    FROM sys.foreign_keys fk
    WHERE fk.parent_object_id = OBJECT_ID('dbo.AdminNotes')
  `);
  for (const row of fks.recordset) {
    if (row.RefTable === "AdminUsers") {
      const name = String(row.FkName).replace(/]/g, "]]");
      await db.request().query(`ALTER TABLE dbo.AdminNotes DROP CONSTRAINT [${name}]`);
    }
  }

  const hasUsersFk = await db.request().query(`
    SELECT COUNT(*) AS C
    FROM sys.foreign_keys fk
    WHERE fk.parent_object_id = OBJECT_ID('dbo.AdminNotes')
      AND fk.referenced_object_id = OBJECT_ID('dbo.Users')
  `);
  if (Number(hasUsersFk.recordset[0]?.C) === 0) {
    await db.request().query(`
      ALTER TABLE dbo.AdminNotes ADD CONSTRAINT FK_AdminNotes_AdminUser_Users
        FOREIGN KEY (AdminUserId) REFERENCES dbo.Users(Id)
    `);
  }

  await db.request().query(`DROP TABLE dbo.AdminUsers`);
}

console.log("Users.IsAdmin migration complete.");
process.exit(0);
