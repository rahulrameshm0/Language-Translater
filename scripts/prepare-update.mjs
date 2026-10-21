import { readFileSync, writeFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url))).expo;
const [url, ...description] = process.argv.slice(2);
const prefix = 'https://github.com/rahulrameshm0/vaylo-downloads/releases/download/';
if (!url?.startsWith(prefix) || !url.endsWith('.apk') || new URL(url).search || new URL(url).hash) {
  throw new Error('Supply the published vaylo-downloads GitHub release APK URL.');
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = `insert into public.app_releases (platform,version,build_number,download_url,notes)\nvalues ('android',${quote(config.version)},${config.android.versionCode},${quote(url)},${quote(description.join(' ') || 'A new Vaylo update is ready.')})\non conflict (platform) do update set version=excluded.version, build_number=excluded.build_number, download_url=excluded.download_url, notes=excluded.notes, published_at=now();\n`;
writeFileSync('release-update.sql', sql);
console.log('Created release-update.sql. Verify the APK is public, then run it in the Supabase SQL editor.');
