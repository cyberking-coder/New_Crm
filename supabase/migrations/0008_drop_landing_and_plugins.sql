-- WebinarOS — remove landing pages and plugin system.
--
-- This migration drops tables introduced by 0002, 0005 and 0006 that are no
-- longer referenced by the application. Run it only after confirming you don't
-- need the data in these tables (landing page copy, published pages, blocks,
-- installed plugin configs). The application works without this migration —
-- the dropped tables simply go unused.

drop table if exists public.landing_page_blocks cascade;
drop table if exists public.landing_pages cascade;
drop type if exists public.landing_block_kind;

drop table if exists public.plugins_installed cascade;

-- The create-landing-page-on-webinar trigger is now orphaned; drop it.
drop trigger if exists on_webinar_created_make_landing on public.webinars;
drop function if exists public.create_landing_page_for_webinar();
