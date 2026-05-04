import sql from "mssql";
import { env } from "./env.js";

let pool;

export async function getDb() {
  if (!pool) {
    pool = await sql.connect(env.db);
  }

  return pool;
}

export { sql };
