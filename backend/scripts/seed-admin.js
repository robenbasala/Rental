/**
 * Upserts demo admin (fixes "Invalid credentials" when DB row/hash is wrong).
 * Usage: npm run seed:admin
 */
import dotenv from "dotenv";
import sql from "mssql";
import bcrypt from "bcryptjs";

dotenv.config();

const email = "admin@kidsrental.local";
const password = process.env.ADMIN_SEED_PASSWORD || "Admin123!";
const name = "Demo Admin";

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false"
  }
};

const hash = bcrypt.hashSync(password, 10);

const pool = await sql.connect(config);

const existing = await pool
  .request()
  .input("email", sql.NVarChar, email)
  .query("SELECT Id FROM AdminUsers WHERE Email = @email");

if (existing.recordset.length) {
  await pool
    .request()
    .input("email", sql.NVarChar, email)
    .input("hash", sql.NVarChar, hash)
    .query("UPDATE AdminUsers SET PasswordHash = @hash, IsActive = 1, UpdatedAt = SYSUTCDATETIME() WHERE Email = @email");
  console.log(`Updated admin password for ${email} (password: ${password})`);
} else {
  await pool
    .request()
    .input("name", sql.NVarChar, name)
    .input("email", sql.NVarChar, email)
    .input("hash", sql.NVarChar, hash)
    .query(`
      INSERT INTO AdminUsers (Name, Email, PasswordHash, IsActive)
      VALUES (@name, @email, @hash, 1)
    `);
  console.log(`Created admin ${email} (password: ${password})`);
}

await pool.close();
process.exit(0);
