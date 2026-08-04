import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "@vercel/postgres";

async function migrate() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await sql.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await sql.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    const migration = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.query(migration);
    await sql.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`Applied ${file}`);
  }
}

migrate().catch((error: unknown) => {
  console.error("Migration failed.", error);
  process.exitCode = 1;
});
