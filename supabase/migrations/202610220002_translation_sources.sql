alter table public.translations add column input_kind text not null default 'text' check (input_kind in ('text','voice','document','recording','call'));
alter table public.translations add column source_name text check (char_length(source_name)<=180);
