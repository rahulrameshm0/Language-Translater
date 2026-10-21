-- Keep legacy Malayalam history; new requests use the 30-language allowlist.
alter table public.translations drop constraint translations_source_language_check;
alter table public.translations add constraint translations_source_language_check check (source_language in ('en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi','ml'));
alter table public.translations drop constraint translations_target_language_check;
alter table public.translations add constraint translations_target_language_check check (target_language in ('en','es','hy','de','fr','it','pt','ru','uk','pl','nl','sv','no','da','fi','el','tr','ar','he','fa','hi','bn','ta','te','kn','ja','ko','zh','id','vi','ml'));
