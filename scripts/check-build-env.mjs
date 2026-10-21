const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let validUrl = false;
try {
  validUrl = new URL(url).protocol === 'https:';
} catch {}
if (!validUrl || !key || url.includes('YOUR_') || key.includes('YOUR_')) {
  console.error('Build stopped: configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the EAS build environment first.');
  process.exit(1);
}
console.log('Public backend configuration is present. No secrets are printed.');
