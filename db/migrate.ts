import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "@vercel/postgres";

async function migrate() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const migration = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.query(migration);
    console.log(`Applied ${file}`);
  }
}

migrate().catch((error: unknown) => {
  console.error("Migration failed.", error);
  process.exitCode = 1;
});
