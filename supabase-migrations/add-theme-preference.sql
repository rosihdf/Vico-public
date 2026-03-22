-- Theme (Hell/Dunkel/System) pro Nutzer, Sync zwischen Haupt-App und Portalen
alter table public.profiles add column if not exists theme_preference text default null;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_theme_preference_check;
exception when others then null;
end $$;

alter table public.profiles add constraint profiles_theme_preference_check
  check (theme_preference is null or theme_preference in ('light', 'dark', 'system'));

comment on column public.profiles.theme_preference is 'Hell/Dunkel/System – gleiche Logik wie localStorage vico-theme; Sync über alle Clients.';
