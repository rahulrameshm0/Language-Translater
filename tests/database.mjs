import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
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
  await database.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610210001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await database.exec(
    await readFile(new URL("./database.sql", import.meta.url), "utf8"),
  );
  console.log(
    "PASS: migration, account isolation, owner deletion, denied client writes/RPC, and 30-request limit on embedded PostgreSQL.",
  );
} finally {
  await database.close();
}
