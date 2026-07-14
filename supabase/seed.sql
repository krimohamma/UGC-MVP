-- =============================================================================
-- Seed data for local/dev: lookup tables + a few fake creators so the browse
-- experience isn't empty. Idempotent (fixed UUIDs + ON CONFLICT DO NOTHING),
-- so it's safe to re-run.
--
-- NOTE: the fake creators are inserted straight into public.users with random
-- UUIDs and are NOT backed by auth.users rows — they exist only to populate
-- browse/detail pages and cannot be logged into. Real accounts are created
-- through Supabase Auth (lib/auth/actions.ts).
-- =============================================================================

-- --- Content languages (what a gig's video is spoken/written in) --------------
insert into languages (code, name_fr, name_ar, name_en) values
  ('ar', 'Arabe',                 'العربية',              'Arabic'),
  ('fr', 'Français',              'الفرنسية',             'French'),
  ('en', 'Anglais',               'الإنجليزية',           'English'),
  ('dz', 'Darja (arabe algérien)', 'الدارجة الجزائرية',    'Algerian Darja')
on conflict (code) do nothing;

-- --- Niches -------------------------------------------------------------------
insert into niches (id, slug, name_fr, name_ar, name_en, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'beauty',  'Beauté & Cosmétiques', 'الجمال ومستحضرات التجميل', 'Beauty & Cosmetics', true),
  ('a0000000-0000-0000-0000-000000000002', 'fashion', 'Mode & Accessoires',   'الموضة والإكسسوارات',      'Fashion & Accessories', true),
  ('a0000000-0000-0000-0000-000000000003', 'food',    'Cuisine & Gastronomie','الطعام والمأكولات',        'Food & Cooking', true),
  ('a0000000-0000-0000-0000-000000000004', 'tech',    'Tech & Gadgets',       'التقنية والأجهزة',         'Tech & Gadgets', true),
  ('a0000000-0000-0000-0000-000000000005', 'fitness', 'Fitness & Bien-être',  'اللياقة والعافية',         'Fitness & Wellness', true),
  ('a0000000-0000-0000-0000-000000000006', 'home',    'Maison & Déco',        'المنزل والديكور',          'Home & Decor', true),
  ('a0000000-0000-0000-0000-000000000007', 'kids',    'Enfants & Jouets',     'الأطفال والألعاب',         'Kids & Toys', true),
  ('a0000000-0000-0000-0000-000000000008', 'jewelry', 'Bijoux & Montres',     'المجوهرات والساعات',       'Jewelry & Watches', true)
on conflict (id) do nothing;

-- --- Fake creators (users + creator_profiles) ---------------------------------
insert into users (id, role, email, password_hash, full_name, locale, is_verified) values
  ('c1000000-0000-0000-0000-000000000001', 'creator', 'amina.creator@example.dz',  'seed_not_loginable', 'Amina Benali',  'fr', true),
  ('c2000000-0000-0000-0000-000000000002', 'creator', 'yacine.creator@example.dz', 'seed_not_loginable', 'Yacine Haddad', 'ar', true),
  ('c3000000-0000-0000-0000-000000000003', 'creator', 'sofia.creator@example.dz',  'seed_not_loginable', 'Sofia Meziane', 'fr', true)
on conflict (id) do nothing;

insert into creator_profiles (user_id, bio, niche_id, years_experience, rating_avg, rating_count, completed_orders_count) values
  ('c1000000-0000-0000-0000-000000000001', 'Créatrice UGC spécialisée beauté & skincare. Vidéos authentiques style TikTok pour marques algériennes.', 'a0000000-0000-0000-0000-000000000001', 3, 4.80, 24, 24),
  ('c2000000-0000-0000-0000-000000000002', 'منشئ محتوى للمنتجات التقنية. فيديوهات إعلانية قصيرة بالدارجة والعربية.', 'a0000000-0000-0000-0000-000000000004', 2, 4.60, 11, 11),
  ('c3000000-0000-0000-0000-000000000003', 'Passionnée de mode. Try-on hauls et vidéos produits pour boutiques en ligne.', 'a0000000-0000-0000-0000-000000000002', 4, 4.90, 37, 37)
on conflict (user_id) do nothing;

-- --- Portfolio items (external links for seed; real uploads land in bucket) ---
insert into portfolio_items (id, creator_id, title, external_url, thumbnail_url, sort_order) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Routine skincare — marque locale', 'https://www.tiktok.com/@amina/video/0001', 'https://picsum.photos/seed/amina1/360/640', 0),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Unboxing crème hydratante',       'https://www.tiktok.com/@amina/video/0002', 'https://picsum.photos/seed/amina2/360/640', 1),
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Test rouge à lèvres',              'https://www.instagram.com/reel/amina0003', 'https://picsum.photos/seed/amina3/360/640', 2),
  ('d2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'إعلان سماعات لاسلكية',             'https://www.tiktok.com/@yacine/video/0001', 'https://picsum.photos/seed/yacine1/360/640', 0),
  ('d2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'مراجعة شاحن سريع',                 'https://www.tiktok.com/@yacine/video/0002', 'https://picsum.photos/seed/yacine2/360/640', 1),
  ('d3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000003', 'Try-on haul automne',              'https://www.instagram.com/reel/sofia0001', 'https://picsum.photos/seed/sofia1/360/640', 0),
  ('d3000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003', 'Lookbook boutique en ligne',       'https://www.tiktok.com/@sofia/video/0002',  'https://picsum.photos/seed/sofia2/360/640', 1)
on conflict (id) do nothing;

-- --- Gigs + packages + content languages --------------------------------------
-- base_price_dzd is kept equal to the cheapest package price (denormalized).

insert into gigs (id, creator_id, niche_id, title, description, status, cover_media_url, base_price_dzd, avg_rating, orders_count) values
  ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'Vidéo UGC produit cosmétique style TikTok',
    'Je crée une vidéo UGC authentique de 30 à 60 secondes pour votre produit cosmétique : présentation, application et avis sincère. Format vertical prêt pour TikTok, Instagram Reels et vos publicités.',
    'active', 'https://picsum.photos/seed/gig1/800/450', 4000, 4.80, 24),
  ('e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'Unboxing skincare authentique',
    'Vidéo unboxing chaleureuse et authentique de votre routine skincare. Idéale pour créer la confiance et présenter plusieurs produits à la fois.',
    'active', 'https://picsum.photos/seed/gig2/800/450', 3500, 4.70, 9),
  ('e2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004',
    'إعلان فيديو لمنتج تقني بالدارجة',
    'فيديو إعلاني قصير واحترافي لمنتجك التقني (سماعات، شواحن، إكسسوارات). شرح المميزات بأسلوب بسيط وجذاب بالدارجة الجزائرية أو العربية الفصحى.',
    'active', 'https://picsum.photos/seed/gig3/800/450', 5000, 4.60, 11),
  ('e3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002',
    'Try-on haul mode pour votre boutique',
    'Vidéo try-on haul dynamique présentant jusqu''à 5 pièces de votre boutique. Mise en valeur des coupes, matières et coordonnés pour donner envie d''acheter.',
    'active', 'https://picsum.photos/seed/gig4/800/450', 6000, 4.90, 37)
on conflict (id) do nothing;

insert into gig_languages (gig_id, language_code) values
  ('e1000000-0000-0000-0000-000000000001', 'fr'),
  ('e1000000-0000-0000-0000-000000000001', 'ar'),
  ('e1000000-0000-0000-0000-000000000002', 'fr'),
  ('e2000000-0000-0000-0000-000000000001', 'dz'),
  ('e2000000-0000-0000-0000-000000000001', 'ar'),
  ('e3000000-0000-0000-0000-000000000001', 'fr')
on conflict (gig_id, language_code) do nothing;

insert into gig_packages (id, gig_id, tier, title, description, price_dzd, delivery_days, revisions_included, features) values
  -- Gig 1
  ('f1100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'basic',    'Essentiel', '1 vidéo verticale 30s', 4000, 4, 1, array['1 vidéo 30s','Format vertical 9:16','1 révision']),
  ('f1100000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'standard', 'Populaire', '1 vidéo verticale 60s + sous-titres', 7000, 5, 2, array['1 vidéo 60s','Sous-titres FR/AR','2 révisions']),
  ('f1100000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'premium',  'Premium', '2 vidéos + montage avancé', 12000, 7, 3, array['2 vidéos','Montage avancé','Musique tendance','3 révisions']),
  -- Gig 2
  ('f1200000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'basic',    'Essentiel', 'Unboxing simple 30s', 3500, 3, 1, array['1 vidéo 30s','1 révision']),
  ('f1200000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'standard', 'Populaire', 'Unboxing détaillé 60s', 6000, 5, 2, array['1 vidéo 60s','Gros plans produit','2 révisions']),
  ('f1200000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'premium',  'Premium', 'Unboxing + démonstration', 9500, 6, 3, array['Vidéo 90s','Démonstration','3 révisions']),
  -- Gig 3
  ('f2100000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'basic',    'أساسي',   'فيديو إعلاني 20 ثانية', 5000, 4, 1, array['فيديو 20 ثانية','صيغة عمودية','مراجعة واحدة']),
  ('f2100000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'standard', 'الأكثر طلبًا', 'فيديو 40 ثانية مع مؤثرات', 9000, 5, 2, array['فيديو 40 ثانية','مؤثرات ونص','مراجعتان']),
  ('f2100000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000001', 'premium',  'مميز',    'فيديوهان + سكريبت احترافي', 15000, 7, 3, array['فيديوهان','سكريبت احترافي','موسيقى','3 مراجعات']),
  -- Gig 4
  ('f3100000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 'basic',    'Essentiel', 'Try-on 3 pièces', 6000, 5, 1, array['Vidéo 45s','3 pièces','1 révision']),
  ('f3100000-0000-0000-0000-000000000002', 'e3000000-0000-0000-0000-000000000001', 'standard', 'Populaire', 'Try-on 5 pièces + musique', 10000, 6, 2, array['Vidéo 60s','5 pièces','Musique tendance','2 révisions']),
  ('f3100000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000001', 'premium',  'Premium', 'Try-on 5 pièces + 2 formats', 16000, 8, 3, array['2 formats (Reels + Story)','5 pièces','Montage premium','3 révisions'])
on conflict (id) do nothing;
