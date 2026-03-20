-- Migration: Spalte arbeitszeitenportal_domain zu tenants hinzufügen
-- Ausführen im Supabase SQL Editor des Lizenzportal-Projekts

alter table public.tenants add column if not exists arbeitszeitenportal_domain text;
