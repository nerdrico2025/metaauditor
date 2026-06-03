-- Variable: Company ID to associate data with
\set company_id '315d9695-542c-4db9-9b0a-a57383677737'

DO $$
DECLARE
    v_company_id UUID := '315d9695-542c-4db9-9b0a-a57383677737';
    v_camp_fashion UUID;
    v_camp_saas UUID;
    v_camp_webinar UUID;
    v_camp_fitness UUID;
    v_camp_realestate UUID;
    v_adset UUID;
    v_creative UUID;
    v_date DATE;
    v_impressions INT;
    v_clicks INT;
    v_spend NUMERIC;
    v_conversions INT;
    i INT;
BEGIN
    -- ==========================================
    -- 1. CAMPAIGN: Fashion E-commerce (Sales)
    -- ==========================================
    INSERT INTO public.campaigns (company_id, name, status, objective, platform, daily_budget)
    VALUES (v_company_id, 'Fashion - Coleção Verão 2026', 'ACTIVE', 'SALES', 'meta', 150.00)
    RETURNING id INTO v_camp_fashion;

    -- Ad Set 1: Broad Audience
    INSERT INTO public.ad_sets (campaign_id, name, status, bid_strategy)
    VALUES (v_camp_fashion, 'Aberto - Mulheres 18-35', 'ACTIVE', 'LOWEST_COST')
    RETURNING id INTO v_adset;

    -- Creative 1: Lifestyle Image
    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, body_text, headline)
    VALUES (v_adset, 'Img_Lifestyle_Praia', 'ACTIVE', 'image', 
            'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
            'Descubra a nova coleção de verão. Peças leves e exclusivas.', 'Verão 2026 Chegou ☀️');
    
    -- Creative 2: Product Carousel (Mocked as single image for now)
    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, body_text, headline)
    VALUES (v_adset, 'Carrossel_BestSellers', 'ACTIVE', 'image', 
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
            'Os favoritos da estação estão acabando. Garanta o seu!', 'Best Sellers com 20% OFF');

    -- Metrics Loop (30 days)
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        v_impressions := floor(random() * 5000 + 1000);
        v_clicks := floor(v_impressions * (random() * 0.03 + 0.01)); -- 1-4% CTR
        v_spend := v_clicks * (random() * 1.5 + 0.5); -- CPC 0.50 - 2.00
        v_conversions := floor(v_clicks * (random() * 0.05)); -- 0-5% Conv Rate

        INSERT INTO public.campaign_metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
        VALUES (v_camp_fashion, v_date, v_impressions, v_clicks, v_spend, v_conversions, v_conversions * 120.00);
    END LOOP;


    -- ==========================================
    -- 2. CAMPAIGN: SaaS Analytics (Leads)
    -- ==========================================
    INSERT INTO public.campaigns (company_id, name, status, objective, platform, daily_budget)
    VALUES (v_company_id, 'SaaS - B2B Lead Gen', 'ACTIVE', 'LEADS', 'google', 300.00)
    RETURNING id INTO v_camp_saas;

    INSERT INTO public.ad_sets (campaign_id, name, status)
    VALUES (v_camp_saas, 'Keywords - Competitors', 'ACTIVE')
    RETURNING id INTO v_adset;

    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, headline)
    VALUES (v_adset, 'Video_Demo_Dashboard', 'ACTIVE', 'video',
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
            'Pare de adivinhar seus dados. Teste Grátis.');

    -- Metrics Loop
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        v_impressions := floor(random() * 2000 + 500);
        v_clicks := floor(v_impressions * (random() * 0.05 + 0.02)); -- 2-7% CTR
        v_spend := v_clicks * (random() * 5.0 + 2.0); -- High CPC
        v_conversions := floor(v_clicks * (random() * 0.08)); 

        INSERT INTO public.campaign_metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
        VALUES (v_camp_saas, v_date, v_impressions, v_clicks, v_spend, v_conversions, 0); -- Leads typically 0 immediate revenue
    END LOOP;


    -- ==========================================
    -- 3. CAMPAIGN: Webinar Masterclass (Awareness)
    -- ==========================================
    INSERT INTO public.campaigns (company_id, name, status, objective, platform, daily_budget)
    VALUES (v_company_id, 'Webinar - Masterclass IA', 'PAUSED', 'AWARENESS', 'meta', 100.00)
    RETURNING id INTO v_camp_webinar;

    INSERT INTO public.ad_sets (campaign_id, name, status)
    VALUES (v_camp_webinar, 'Lookalike 1% Compradores', 'PAUSED')
    RETURNING id INTO v_adset;

    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, headline)
    VALUES (v_adset, 'Img_Speaker_Close', 'PAUSED', 'image',
            'https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&w=800&q=80',
            'Aprenda IA em 60 minutos.');

    -- Metrics Loop
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        v_impressions := floor(random() * 10000 + 5000);
        v_clicks := floor(v_impressions * (random() * 0.01 + 0.005)); -- Low CTR
        v_spend := v_clicks * (random() * 0.8 + 0.2); 
        v_conversions := floor(v_clicks * (random() * 0.20)); -- High conv rate (signups)

        INSERT INTO public.campaign_metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
        VALUES (v_camp_webinar, v_date, v_impressions, v_clicks, v_spend, v_conversions, 0);
    END LOOP;


    -- ==========================================
    -- 4. CAMPAIGN: Fitness App (App Install)
    -- ==========================================
    INSERT INTO public.campaigns (company_id, name, status, objective, platform, daily_budget)
    VALUES (v_company_id, 'App Install - Q1 Push', 'ACTIVE', 'APP_INSTALLS', 'meta', 250.00)
    RETURNING id INTO v_camp_fitness;

    INSERT INTO public.ad_sets (campaign_id, name, status)
    VALUES (v_camp_fitness, 'Interest - Gym & Yoga', 'ACTIVE')
    RETURNING id INTO v_adset;

    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, body_text)
    VALUES (v_adset, 'Video_Workout_Energy', 'ACTIVE', 'video',
            'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
            'Treine em qualquer lugar. Baixe agora.');

    -- Metrics Loop
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        v_impressions := floor(random() * 8000 + 2000);
        v_clicks := floor(v_impressions * (random() * 0.02 + 0.01)); 
        v_spend := v_clicks * (random() * 1.0 + 0.5); 
        v_conversions := floor(v_clicks * (random() * 0.10)); 

        INSERT INTO public.campaign_metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
        VALUES (v_camp_fitness, v_date, v_impressions, v_clicks, v_spend, v_conversions, v_conversions * 29.90);
    END LOOP;


    -- ==========================================
    -- 5. CAMPAIGN: Luxury Real Estate (Leads)
    -- ==========================================
    INSERT INTO public.campaigns (company_id, name, status, objective, platform, daily_budget)
    VALUES (v_company_id, 'Real Estate - Alphaville', 'ACTIVE', 'LEADS', 'meta', 500.00)
    RETURNING id INTO v_camp_realestate;

    INSERT INTO public.ad_sets (campaign_id, name, status)
    VALUES (v_camp_realestate, 'Geo - High Income', 'ACTIVE')
    RETURNING id INTO v_adset;

    INSERT INTO public.creatives (ad_set_id, name, status, format, image_url, headline)
    VALUES (v_adset, 'Img_Mansion_Facade', 'ACTIVE', 'image',
            'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=800&q=80',
            'Sua nova casa dos sonhos espera por você.');

    -- Metrics Loop
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        v_impressions := floor(random() * 1500 + 200);
        v_clicks := floor(v_impressions * (random() * 0.04 + 0.01)); 
        v_spend := v_clicks * (random() * 8.0 + 3.0); -- Very High CPC
        v_conversions := floor(v_clicks * (random() * 0.02)); -- Low conv rate (high ticket)

        INSERT INTO public.campaign_metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
        VALUES (v_camp_realestate, v_date, v_impressions, v_clicks, v_spend, v_conversions, 0);
    END LOOP;

END $$;
