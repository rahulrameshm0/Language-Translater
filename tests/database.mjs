import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const database = new PGlite();
try {
  // Minimal Supabase Auth contracts; PostgreSQL executes the real migration and policies.
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
  `);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await database.exec(await readFile(new URL(file, migrations), "utf8"));
  await database.exec(
    await readFile(new URL("./database.sql", import.meta.url), "utf8"),
  );
  await database.exec(
    await readFile(new URL("./releases.sql", import.meta.url), "utf8"),
  );
  await database.exec(
    await readFile(new URL("./languages.sql", import.meta.url), "utf8"),
  );
  await database.exec(
    await readFile(new URL("./learning.sql", import.meta.url), "utf8"),
  );
  await database.exec(
    await readFile(new URL("./conversations.sql", import.meta.url), "utf8"),
  );
  console.log(
    "PASS: migration, account isolation, owner deletion, denied client writes/RPC, and 30-request limit on embedded PostgreSQL.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await database.close();
}
