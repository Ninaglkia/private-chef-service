/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    // Authenticated Supabase user resolved once in middleware (or null).
    user: import('@supabase/supabase-js').User | null;
  }
}
