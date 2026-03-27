-- =============================================================
-- VEXERA Mock Data for Local Development
-- =============================================================
-- Run with: psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/mock_data.sql
-- Or via Supabase Dashboard SQL Editor at http://127.0.0.1:54323

BEGIN;

-- =============================================================
-- 1. AUTH USERS (inserted directly into auth.users)
-- =============================================================
-- Password for all users: "password123"
-- bcrypt hash of "password123"

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'jan.novak@example.com',
   '$2a$10$PznUGjOGLsfRCE9NqQvi0O3iFPGITvVDEbN2eRgRv2QGLYGjU5dWC',
   NOW(), '{"full_name": "Ján Novák", "avatar_url": null}'::jsonb,
   'authenticated', 'authenticated', NOW(), NOW(), '', ''),

  ('a2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'maria.kovacova@example.com',
   '$2a$10$PznUGjOGLsfRCE9NqQvi0O3iFPGITvVDEbN2eRgRv2QGLYGjU5dWC',
   NOW(), '{"full_name": "Mária Kováčová", "avatar_url": null}'::jsonb,
   'authenticated', 'authenticated', NOW(), NOW(), '', ''),

  ('a3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'peter.horvath@example.com',
   '$2a$10$PznUGjOGLsfRCE9NqQvi0O3iFPGITvVDEbN2eRgRv2QGLYGjU5dWC',
   NOW(), '{"full_name": "Peter Horváth", "avatar_url": null}'::jsonb,
   'authenticated', 'authenticated', NOW(), NOW(), '', '')
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for login to work)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   '{"sub": "a1111111-1111-1111-1111-111111111111", "email": "jan.novak@example.com"}'::jsonb,
   'email', 'a1111111-1111-1111-1111-111111111111', NOW(), NOW(), NOW()),
  ('a2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222',
   '{"sub": "a2222222-2222-2222-2222-222222222222", "email": "maria.kovacova@example.com"}'::jsonb,
   'email', 'a2222222-2222-2222-2222-222222222222', NOW(), NOW(), NOW()),
  ('a3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333',
   '{"sub": "a3333333-3333-3333-3333-333333333333", "email": "peter.horvath@example.com"}'::jsonb,
   'email', 'a3333333-3333-3333-3333-333333333333', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Profiles are created by the handle_new_user() trigger,
-- but if users already exist we ensure profiles are there:
INSERT INTO public.profiles (id, email, full_name, avatar_url)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'jan.novak@example.com', 'Ján Novák', NULL),
  ('a2222222-2222-2222-2222-222222222222', 'maria.kovacova@example.com', 'Mária Kováčová', NULL),
  ('a3333333-3333-3333-3333-333333333333', 'peter.horvath@example.com', 'Peter Horváth', NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 2. ORGANIZATIONS
-- =============================================================
INSERT INTO public.organizations (id, name, ico, dic, ic_dph, address_street, address_city, address_zip, address_country, email, phone, bank_iban, bank_swift, subscription_plan, organization_type)
VALUES
  ('b1111111-1111-1111-1111-111111111111',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678',
   'Hlavná 15', 'Bratislava', '81101', 'SK',
   'info@techflow.sk', '+421 2 1234 5678',
   'SK89 1100 0000 0012 3456 7890', 'TATRSKBX',
   'small_business', 'company'),

  ('b2222222-2222-2222-2222-222222222222',
   'Ján Novák - IT Konzultácie', '87654321', 'SK1087654321', NULL,
   'Štúrova 42', 'Košice', '04001', 'SK',
   'jan@novak-it.sk', '+421 9 8765 4321',
   'SK31 0900 0000 0098 7654 3210', 'GIBASKBX',
   'freelancer', 'freelancer')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 3. ORGANIZATION MEMBERS
-- =============================================================
INSERT INTO public.organization_members (id, organization_id, user_id, role)
VALUES
  -- TechFlow: Jan is owner, Maria is admin
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'owner'),
  ('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'admin'),
  -- Freelancer org: Jan is owner
  ('c3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'owner'),
  -- Peter is accountant member of TechFlow
  ('c4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'member')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- =============================================================
-- 4. CONTACTS (Clients & Suppliers for TechFlow)
-- =============================================================
INSERT INTO public.contacts (id, organization_id, name, ico, dic, ic_dph, contact_type, street, city, postal_code, country, email, phone, bank_account, is_key_client, total_invoiced, invoice_count, avg_payment_days)
VALUES
  -- Clients
  ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'GreenEnergy a.s.', '11223344', 'SK2011223344', 'SK2011223344',
   'client', 'Energetická 7', 'Žilina', '01001', 'SK',
   'fakturacia@greenenergy.sk', '+421 41 555 1234',
   'SK55 0200 0000 0011 2233 4455', TRUE,
   24500.00, 8, 21),

  ('d2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'MediCare Plus s.r.o.', '22334455', 'SK2022334455', NULL,
   'client', 'Nemocničná 3', 'Martin', '03601', 'SK',
   'objednavky@medicareplus.sk', '+421 43 555 6789',
   'SK66 1100 0000 0022 3344 5566', FALSE,
   8200.00, 3, 35),

  ('d3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'AutoDom Slovakia s.r.o.', '33445566', 'SK2033445566', 'SK2033445566',
   'client', 'Automobilová 22', 'Trnava', '91701', 'SK',
   'it@autodom.sk', '+421 33 555 9876',
   'SK77 0900 0000 0033 4455 6677', TRUE,
   42000.00, 12, 14),

  -- Suppliers
  ('d4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   'CloudHost s.r.o.', '44556677', 'SK2044556677', 'SK2044556677',
   'supplier', 'Serverová 1', 'Bratislava', '82109', 'SK',
   'billing@cloudhost.sk', '+421 2 555 1111',
   'SK88 1100 0000 0044 5566 7788', FALSE,
   6800.00, 12, 0),

  ('d5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111',
   'OfficeSupply Pro s.r.o.', '55667788', 'SK2055667788', NULL,
   'supplier', 'Skladová 45', 'Nitra', '94901', 'SK',
   'obchod@officesupply.sk', '+421 37 555 2222',
   'SK99 0200 0000 0055 6677 8899', FALSE,
   1450.00, 5, 0),

  -- Both (client + supplier)
  ('d6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111',
   'DigitalAgency s.r.o.', '66778899', 'SK2066778899', 'SK2066778899',
   'both', 'Kreatívna 8', 'Bratislava', '81103', 'SK',
   'hello@digitalagency.sk', '+421 2 555 3333',
   'SK11 0900 0000 0066 7788 9900', FALSE,
   15600.00, 6, 28)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 5. PRODUCTS / SERVICES
-- =============================================================
INSERT INTO public.products (id, organization_id, name, description, sku, unit, unit_price_net, vat_rate, currency, total_revenue, times_invoiced, is_active)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'Webová aplikácia na mieru', 'Vývoj webovej aplikácie podľa špecifikácie', 'DEV-WEB', 'hod', 85.00, 20, 'EUR', 34000.00, 12, TRUE),

  ('e2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'IT konzultácie', 'Konzultačné služby v oblasti IT', 'CONS-IT', 'hod', 95.00, 20, 'EUR', 19000.00, 8, TRUE),

  ('e3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'Správa serverov', 'Mesačný paušál za správu serverovej infraštruktúry', 'SRV-MGMT', 'mes', 450.00, 20, 'EUR', 5400.00, 12, TRUE),

  ('e4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   'SEO optimalizácia', 'Optimalizácia pre vyhľadávače', 'MKT-SEO', 'mes', 350.00, 20, 'EUR', 4200.00, 6, TRUE),

  ('e5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111',
   'Grafický návrh', 'UI/UX dizajn a grafické návrhy', 'DES-UI', 'hod', 75.00, 20, 'EUR', 7500.00, 4, TRUE),

  ('e6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111',
   'Technická podpora', 'Riešenie technických problémov a helpdesk', 'SUP-TECH', 'hod', 55.00, 20, 'EUR', 2200.00, 3, FALSE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 6. INVOICES — ISSUED (TechFlow billing clients)
-- =============================================================
INSERT INTO public.invoices (id, organization_id, invoice_number, invoice_type, status, supplier_name, supplier_ico, supplier_dic, supplier_ic_dph, supplier_address, supplier_iban, customer_name, customer_ico, customer_dic, customer_ic_dph, customer_address, issue_date, delivery_date, due_date, paid_at, subtotal, vat_amount, total, currency, payment_method, variable_symbol, contact_id, created_by)
VALUES
  -- FV-2026001: Paid invoice to GreenEnergy
  ('f1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026001', 'issued', 'paid',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'GreenEnergy a.s.', '11223344', 'SK2011223344', 'SK2011223344', 'Energetická 7, 01001 Žilina',
   '2026-01-15', '2026-01-15', '2026-01-29', '2026-01-25 10:30:00+01',
   3400.00, 680.00, 4080.00, 'EUR', 'bank_transfer', '2026001',
   'd1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111'),

  -- FV-2026002: Paid invoice to AutoDom
  ('f2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026002', 'issued', 'paid',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'AutoDom Slovakia s.r.o.', '33445566', 'SK2033445566', 'SK2033445566', 'Automobilová 22, 91701 Trnava',
   '2026-01-20', '2026-01-20', '2026-02-03', '2026-01-31 14:15:00+01',
   5500.00, 1100.00, 6600.00, 'EUR', 'bank_transfer', '2026002',
   'd3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111'),

  -- FV-2026003: Sent (not yet paid) to MediCare
  ('f3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026003', 'issued', 'sent',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'MediCare Plus s.r.o.', '22334455', 'SK2022334455', NULL, 'Nemocničná 3, 03601 Martin',
   '2026-02-10', '2026-02-10', '2026-02-24', NULL,
   2850.00, 570.00, 3420.00, 'EUR', 'bank_transfer', '2026003',
   'd2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222'),

  -- FV-2026004: Overdue invoice to GreenEnergy
  ('f4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026004', 'issued', 'overdue',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'GreenEnergy a.s.', '11223344', 'SK2011223344', 'SK2011223344', 'Energetická 7, 01001 Žilina',
   '2026-02-01', '2026-02-01', '2026-02-15', NULL,
   1900.00, 380.00, 2280.00, 'EUR', 'bank_transfer', '2026004',
   'd1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111'),

  -- FV-2026005: Draft invoice to DigitalAgency
  ('f5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026005', 'issued', 'draft',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'DigitalAgency s.r.o.', '66778899', 'SK2066778899', 'SK2066778899', 'Kreatívna 8, 81103 Bratislava',
   '2026-03-01', '2026-03-01', '2026-03-15', NULL,
   4250.00, 850.00, 5100.00, 'EUR', 'bank_transfer', '2026005',
   'd6666666-6666-6666-6666-666666666666', 'a1111111-1111-1111-1111-111111111111'),

  -- FV-2026006: Sent to AutoDom (recent)
  ('f6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111',
   'FV-2026006', 'issued', 'sent',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava', 'SK89 1100 0000 0012 3456 7890',
   'AutoDom Slovakia s.r.o.', '33445566', 'SK2033445566', 'SK2033445566', 'Automobilová 22, 91701 Trnava',
   '2026-03-05', '2026-03-05', '2026-03-19', NULL,
   3800.00, 760.00, 4560.00, 'EUR', 'bank_transfer', '2026006',
   'd3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111')
ON CONFLICT (organization_id, invoice_number, invoice_type) DO NOTHING;

-- =============================================================
-- 7. INVOICES — RECEIVED (TechFlow paying suppliers)
-- =============================================================
INSERT INTO public.invoices (id, organization_id, invoice_number, invoice_type, status, supplier_name, supplier_ico, supplier_dic, supplier_ic_dph, supplier_address, supplier_iban, customer_name, customer_ico, customer_dic, customer_ic_dph, customer_address, issue_date, delivery_date, due_date, paid_at, subtotal, vat_amount, total, currency, payment_method, variable_symbol, contact_id, created_by)
VALUES
  -- DF-2026001: Paid hosting invoice from CloudHost
  ('f7777777-7777-7777-7777-777777777777', 'b1111111-1111-1111-1111-111111111111',
   'DF-2026001', 'received', 'paid',
   'CloudHost s.r.o.', '44556677', 'SK2044556677', 'SK2044556677', 'Serverová 1, 82109 Bratislava', 'SK88 1100 0000 0044 5566 7788',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava',
   '2026-01-01', '2026-01-01', '2026-01-15', '2026-01-10 09:00:00+01',
   450.00, 90.00, 540.00, 'EUR', 'bank_transfer', '20260101',
   'd4444444-4444-4444-4444-444444444444', 'a2222222-2222-2222-2222-222222222222'),

  -- DF-2026002: Paid office supplies from OfficeSupply
  ('f8888888-8888-8888-8888-888888888888', 'b1111111-1111-1111-1111-111111111111',
   'DF-2026002', 'received', 'paid',
   'OfficeSupply Pro s.r.o.', '55667788', 'SK2055667788', NULL, 'Skladová 45, 94901 Nitra', 'SK99 0200 0000 0055 6677 8899',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava',
   '2026-01-18', '2026-01-18', '2026-02-01', '2026-01-28 11:20:00+01',
   245.00, 49.00, 294.00, 'EUR', 'bank_transfer', '20260118',
   'd5555555-5555-5555-5555-555555555555', 'a2222222-2222-2222-2222-222222222222'),

  -- DF-2026003: February hosting
  ('f9999999-9999-9999-9999-999999999999', 'b1111111-1111-1111-1111-111111111111',
   'DF-2026003', 'received', 'paid',
   'CloudHost s.r.o.', '44556677', 'SK2044556677', 'SK2044556677', 'Serverová 1, 82109 Bratislava', 'SK88 1100 0000 0044 5566 7788',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava',
   '2026-02-01', '2026-02-01', '2026-02-15', '2026-02-12 08:45:00+01',
   450.00, 90.00, 540.00, 'EUR', 'bank_transfer', '20260201',
   'd4444444-4444-4444-4444-444444444444', 'a2222222-2222-2222-2222-222222222222'),

  -- DF-2026004: Design subcontract from DigitalAgency
  ('fa111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'DF-2026004', 'received', 'sent',
   'DigitalAgency s.r.o.', '66778899', 'SK2066778899', 'SK2066778899', 'Kreatívna 8, 81103 Bratislava', 'SK11 0900 0000 0066 7788 9900',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava',
   '2026-02-20', '2026-02-20', '2026-03-06', NULL,
   1200.00, 240.00, 1440.00, 'EUR', 'bank_transfer', '20260220',
   'd6666666-6666-6666-6666-666666666666', 'a2222222-2222-2222-2222-222222222222'),

  -- DF-2026005: March hosting
  ('fa222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'DF-2026005', 'received', 'sent',
   'CloudHost s.r.o.', '44556677', 'SK2044556677', 'SK2044556677', 'Serverová 1, 82109 Bratislava', 'SK88 1100 0000 0044 5566 7788',
   'TechFlow s.r.o.', '12345678', 'SK2012345678', 'SK2012345678', 'Hlavná 15, 81101 Bratislava',
   '2026-03-01', '2026-03-01', '2026-03-15', NULL,
   450.00, 90.00, 540.00, 'EUR', 'bank_transfer', '20260301',
   'd4444444-4444-4444-4444-444444444444', 'a2222222-2222-2222-2222-222222222222')
ON CONFLICT (organization_id, invoice_number, invoice_type) DO NOTHING;

-- =============================================================
-- 8. INVOICE ITEMS
-- =============================================================
INSERT INTO public.invoice_items (id, invoice_id, description, quantity, unit, unit_price, vat_rate, vat_amount, total, sort_order, product_id)
VALUES
  -- FV-2026001 items (GreenEnergy - web dev)
  ('11111111-a001-0001-0001-111111111111', 'f1111111-1111-1111-1111-111111111111', 'Vývoj webovej aplikácie - január', 32, 'hod', 85.00, 20.00, 544.00, 2720.00, 1, 'e1111111-1111-1111-1111-111111111111'),
  ('11111111-a001-0001-0002-111111111111', 'f1111111-1111-1111-1111-111111111111', 'IT konzultácie - architektúra', 8, 'hod', 85.00, 20.00, 136.00, 680.00, 2, 'e2222222-2222-2222-2222-222222222222'),

  -- FV-2026002 items (AutoDom - large project)
  ('11111111-a002-0001-0001-111111111111', 'f2222222-2222-2222-2222-222222222222', 'E-shop modul - vývoj', 40, 'hod', 85.00, 20.00, 680.00, 3400.00, 1, 'e1111111-1111-1111-1111-111111111111'),
  ('11111111-a002-0001-0002-111111111111', 'f2222222-2222-2222-2222-222222222222', 'UI/UX dizajn e-shopu', 16, 'hod', 75.00, 20.00, 240.00, 1200.00, 2, 'e5555555-5555-5555-5555-555555555555'),
  ('11111111-a002-0001-0003-111111111111', 'f2222222-2222-2222-2222-222222222222', 'Správa serverov - január', 1, 'mes', 450.00, 20.00, 90.00, 450.00, 3, 'e3333333-3333-3333-3333-333333333333'),
  ('11111111-a002-0001-0004-111111111111', 'f2222222-2222-2222-2222-222222222222', 'SEO optimalizácia - január', 1, 'mes', 350.00, 20.00, 70.00, 350.00, 4, 'e4444444-4444-4444-4444-444444444444'),
  ('11111111-a002-0001-0005-111111111111', 'f2222222-2222-2222-2222-222222222222', 'Technická podpora', 2, 'hod', 55.00, 20.00, 22.00, 110.00, 5, 'e6666666-6666-6666-6666-666666666666'),

  -- FV-2026003 items (MediCare)
  ('11111111-a003-0001-0001-111111111111', 'f3333333-3333-3333-3333-333333333333', 'Pacientsky portál - vývoj', 24, 'hod', 85.00, 20.00, 408.00, 2040.00, 1, 'e1111111-1111-1111-1111-111111111111'),
  ('11111111-a003-0001-0002-111111111111', 'f3333333-3333-3333-3333-333333333333', 'IT konzultácie - GDPR', 6, 'hod', 95.00, 20.00, 114.00, 570.00, 2, 'e2222222-2222-2222-2222-222222222222'),
  ('11111111-a003-0001-0003-111111111111', 'f3333333-3333-3333-3333-333333333333', 'Grafický návrh UI', 4, 'hod', 75.00, 20.00, 60.00, 300.00, 3, 'e5555555-5555-5555-5555-555555555555'),

  -- FV-2026004 items (GreenEnergy - overdue)
  ('11111111-a004-0001-0001-111111111111', 'f4444444-4444-4444-4444-444444444444', 'API integrácia - energetický systém', 20, 'hod', 95.00, 20.00, 380.00, 1900.00, 1, 'e2222222-2222-2222-2222-222222222222'),

  -- FV-2026005 items (DigitalAgency - draft)
  ('11111111-a005-0001-0001-111111111111', 'f5555555-5555-5555-5555-555555555555', 'Backend vývoj - CMS', 35, 'hod', 85.00, 20.00, 595.00, 2975.00, 1, 'e1111111-1111-1111-1111-111111111111'),
  ('11111111-a005-0001-0002-111111111111', 'f5555555-5555-5555-5555-555555555555', 'Správa serverov - marec', 1, 'mes', 450.00, 20.00, 90.00, 450.00, 2, 'e3333333-3333-3333-3333-333333333333'),
  ('11111111-a005-0001-0003-111111111111', 'f5555555-5555-5555-5555-555555555555', 'SEO optimalizácia - marec', 1, 'mes', 350.00, 20.00, 70.00, 350.00, 3, 'e4444444-4444-4444-4444-444444444444'),
  ('11111111-a005-0001-0004-111111111111', 'f5555555-5555-5555-5555-555555555555', 'Grafické práce', 8, 'hod', 75.00, 20.00, 120.00, 600.00, 4, 'e5555555-5555-5555-5555-555555555555'),

  -- FV-2026006 items (AutoDom - recent)
  ('11111111-a006-0001-0001-111111111111', 'f6666666-6666-6666-6666-666666666666', 'E-shop rozšírenie - platobná brána', 28, 'hod', 85.00, 20.00, 476.00, 2380.00, 1, 'e1111111-1111-1111-1111-111111111111'),
  ('11111111-a006-0001-0002-111111111111', 'f6666666-6666-6666-6666-666666666666', 'Správa serverov - marec', 1, 'mes', 450.00, 20.00, 90.00, 450.00, 2, 'e3333333-3333-3333-3333-333333333333'),
  ('11111111-a006-0001-0003-111111111111', 'f6666666-6666-6666-6666-666666666666', 'IT konzultácie', 8, 'hod', 95.00, 20.00, 152.00, 760.00, 3, 'e2222222-2222-2222-2222-222222222222'),
  ('11111111-a006-0001-0004-111111111111', 'f6666666-6666-6666-6666-666666666666', 'Technická podpora', 4, 'hod', 55.00, 20.00, 44.00, 220.00, 4, 'e6666666-6666-6666-6666-666666666666'),

  -- Received invoice items
  -- DF-2026001 (CloudHost jan)
  ('11111111-b001-0001-0001-111111111111', 'f7777777-7777-7777-7777-777777777777', 'Hosting - VPS Premium - január 2026', 1, 'mes', 350.00, 20.00, 70.00, 420.00, 1, NULL),
  ('11111111-b001-0001-0002-111111111111', 'f7777777-7777-7777-7777-777777777777', 'SSL certifikát - wildcard', 1, 'ks', 100.00, 20.00, 20.00, 120.00, 2, NULL),

  -- DF-2026002 (OfficeSupply)
  ('11111111-b002-0001-0001-111111111111', 'f8888888-8888-8888-8888-888888888888', 'Kancelársky papier A4 (10 balíkov)', 10, 'bal', 4.50, 20.00, 9.00, 45.00, 1, NULL),
  ('11111111-b002-0001-0002-111111111111', 'f8888888-8888-8888-8888-888888888888', 'Tonery do tlačiarne HP', 2, 'ks', 65.00, 20.00, 26.00, 156.00, 2, NULL),
  ('11111111-b002-0001-0003-111111111111', 'f8888888-8888-8888-8888-888888888888', 'Kancelárske potreby - mix', 1, 'ks', 44.00, 20.00, 8.80, 52.80, 3, NULL),

  -- DF-2026003 (CloudHost feb)
  ('11111111-b003-0001-0001-111111111111', 'f9999999-9999-9999-9999-999999999999', 'Hosting - VPS Premium - február 2026', 1, 'mes', 350.00, 20.00, 70.00, 420.00, 1, NULL),
  ('11111111-b003-0001-0002-111111111111', 'f9999999-9999-9999-9999-999999999999', 'Zálohovanie dát - extra', 1, 'mes', 100.00, 20.00, 20.00, 120.00, 2, NULL),

  -- DF-2026004 (DigitalAgency design)
  ('11111111-b004-0001-0001-111111111111', 'fa111111-1111-1111-1111-111111111111', 'Grafický dizajn - landing page', 1, 'ks', 800.00, 20.00, 160.00, 960.00, 1, NULL),
  ('11111111-b004-0001-0002-111111111111', 'fa111111-1111-1111-1111-111111111111', 'Ilustrácie a ikony', 1, 'ks', 400.00, 20.00, 80.00, 480.00, 2, NULL),

  -- DF-2026005 (CloudHost mar)
  ('11111111-b005-0001-0001-111111111111', 'fa222222-2222-2222-2222-222222222222', 'Hosting - VPS Premium - marec 2026', 1, 'mes', 350.00, 20.00, 70.00, 420.00, 1, NULL),
  ('11111111-b005-0001-0002-111111111111', 'fa222222-2222-2222-2222-222222222222', 'Zálohovanie dát - extra', 1, 'mes', 100.00, 20.00, 20.00, 120.00, 2, NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 9. BANK ACCOUNTS
-- =============================================================
INSERT INTO public.bank_accounts (id, organization_id, bank_name, iban, swift, currency, account_holder, is_active)
VALUES
  ('ba111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'Tatra banka', 'SK8911000000001234567890', 'TATRSKBX', 'EUR', 'TechFlow s.r.o.', TRUE),
  ('ba222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'Slovenská sporiteľňa', 'SK3109000000001111222233', 'GIBASKBX', 'EUR', 'TechFlow s.r.o.', TRUE),
  ('ba333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222',
   'Slovenská sporiteľňa', 'SK3109000000009876543210', 'GIBASKBX', 'EUR', 'Ján Novák', TRUE)
ON CONFLICT (organization_id, iban) DO NOTHING;

-- =============================================================
-- 10. BANK TRANSACTIONS
-- =============================================================
INSERT INTO public.bank_transactions (id, organization_id, bank_account_id, transaction_date, amount, currency, variable_symbol, description, counterpart_iban, counterpart_name, match_status, matched_invoice_id, external_id)
VALUES
  -- Incoming payments (positive amounts)
  ('b1011111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-01-25', 4080.00, 'EUR', '2026001', 'Platba za FV-2026001',
   'SK5502000000001122334455', 'GreenEnergy a.s.',
   'matched', 'f1111111-1111-1111-1111-111111111111', 'TXN-2026-001'),

  ('b2022222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-01-31', 6600.00, 'EUR', '2026002', 'Platba za FV-2026002',
   'SK7709000000003344556677', 'AutoDom Slovakia s.r.o.',
   'matched', 'f2222222-2222-2222-2222-222222222222', 'TXN-2026-002'),

  -- Outgoing payments (negative amounts)
  ('b3033333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-01-10', -540.00, 'EUR', '20260101', 'Platba za hosting január',
   'SK8811000000004455667788', 'CloudHost s.r.o.',
   'matched', 'f7777777-7777-7777-7777-777777777777', 'TXN-2026-003'),

  ('b4044444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-01-28', -294.00, 'EUR', '20260118', 'Platba za kancelárske potreby',
   'SK9902000000005566778899', 'OfficeSupply Pro s.r.o.',
   'matched', 'f8888888-8888-8888-8888-888888888888', 'TXN-2026-004'),

  ('b5055555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-02-12', -540.00, 'EUR', '20260201', 'Platba za hosting február',
   'SK8811000000004455667788', 'CloudHost s.r.o.',
   'matched', 'f9999999-9999-9999-9999-999999999999', 'TXN-2026-005'),

  -- Unmatched transactions
  ('b6066666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-02-15', -89.50, 'EUR', NULL, 'O2 Slovakia - mobilné služby',
   'SK1234560000009999888877', 'O2 Slovakia s.r.o.',
   'unmatched', NULL, 'TXN-2026-006'),

  ('b7077777-7777-7777-7777-777777777777', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-02-28', -156.00, 'EUR', NULL, 'Slovak Telekom - internet',
   'SK9876540000001111222233', 'Slovak Telekom a.s.',
   'unmatched', NULL, 'TXN-2026-007'),

  ('b8088888-8888-8888-8888-888888888888', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-03-01', 1500.00, 'EUR', '9900123', 'Neidentifikovaná platba',
   'SK5566778899001234567890', 'Unknown s.r.o.',
   'unmatched', NULL, 'TXN-2026-008'),

  ('b9099999-9999-9999-9999-999999999999', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-03-05', -42.30, 'EUR', NULL, 'Kancelárske potreby - doplnenie',
   'SK9902000000005566778899', 'OfficeSupply Pro s.r.o.',
   'unmatched', NULL, 'TXN-2026-009'),

  -- Bank fees
  ('b0a11111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-01-31', -9.90, 'EUR', NULL, 'Poplatok za vedenie účtu - január',
   NULL, 'Tatra banka a.s.',
   'ignored', NULL, 'TXN-2026-010'),

  ('b0a22222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111',
   '2026-02-28', -9.90, 'EUR', NULL, 'Poplatok za vedenie účtu - február',
   NULL, 'Tatra banka a.s.',
   'ignored', NULL, 'TXN-2026-011')
;

-- =============================================================
-- 11. DOCUMENTS
-- =============================================================
INSERT INTO public.documents (id, organization_id, invoice_id, name, file_path, file_size_bytes, mime_type, document_type, ocr_status, status, supplier_name, document_number, issue_date, due_date, total_amount, vat_amount, vat_rate, category, uploaded_by)
VALUES
  ('dc111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'f7777777-7777-7777-7777-777777777777',
   'cloudhost-faktura-jan-2026.pdf', 'documents/b1111111/invoices/cloudhost-jan-2026.pdf',
   245000, 'application/pdf', 'invoice_received', 'done', 'approved',
   'CloudHost s.r.o.', 'CH-2026-0101', '2026-01-01', '2026-01-15', 540.00, 90.00, 20.00, 'hosting',
   'a2222222-2222-2222-2222-222222222222'),

  ('dc222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'f8888888-8888-8888-8888-888888888888',
   'officesupply-faktura-jan-2026.pdf', 'documents/b1111111/invoices/officesupply-jan-2026.pdf',
   189000, 'application/pdf', 'invoice_received', 'done', 'approved',
   'OfficeSupply Pro s.r.o.', 'OS-2026-018', '2026-01-18', '2026-02-01', 294.00, 49.00, 20.00, 'kancelárske potreby',
   'a2222222-2222-2222-2222-222222222222'),

  ('dc333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', NULL,
   'zmluva-greenenergy-2026.pdf', 'documents/b1111111/contracts/zmluva-greenenergy.pdf',
   520000, 'application/pdf', 'contract', 'not_queued', 'approved',
   'GreenEnergy a.s.', NULL, '2026-01-05', NULL, NULL, NULL, NULL, NULL,
   'a1111111-1111-1111-1111-111111111111'),

  ('dc444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', NULL,
   'bloček-kancelária-feb.jpg', 'documents/b1111111/receipts/blocek-feb-2026.jpg',
   1200000, 'image/jpeg', 'receipt', 'done', 'awaiting_review',
   'Tesco Stores SR', NULL, '2026-02-10', NULL, 23.45, 3.91, 20.00, 'potraviny',
   'a2222222-2222-2222-2222-222222222222'),

  ('dc555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'fa111111-1111-1111-1111-111111111111',
   'digitalagency-faktura-feb-2026.pdf', 'documents/b1111111/invoices/digitalagency-feb-2026.pdf',
   312000, 'application/pdf', 'invoice_received', 'done', 'approved',
   'DigitalAgency s.r.o.', 'DA-2026-055', '2026-02-20', '2026-03-06', 1440.00, 240.00, 20.00, 'služby',
   'a2222222-2222-2222-2222-222222222222'),

  ('dc666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', NULL,
   'neznamy-dokument-scan.pdf', 'documents/b1111111/inbox/neznamy-scan.pdf',
   156000, 'application/pdf', NULL, 'queued', 'new',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'a1111111-1111-1111-1111-111111111111'),

  ('dc777777-7777-7777-7777-777777777777', 'b1111111-1111-1111-1111-111111111111', 'fa222222-2222-2222-2222-222222222222',
   'cloudhost-faktura-mar-2026.pdf', 'documents/b1111111/invoices/cloudhost-mar-2026.pdf',
   248000, 'application/pdf', 'invoice_received', 'done', 'awaiting_review',
   'CloudHost s.r.o.', 'CH-2026-0301', '2026-03-01', '2026-03-15', 540.00, 90.00, 20.00, 'hosting',
   'a2222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 12. TAGS
-- =============================================================
INSERT INTO public.tags (id, organization_id, name, tag_type, color)
VALUES
  ('da011111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'GreenEnergy', 'client', '#22c55e'),
  ('da022222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'AutoDom', 'client', '#3b82f6'),
  ('da033333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'MediCare', 'client', '#ef4444'),
  ('da044444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'E-shop projekt', 'project', '#f59e0b'),
  ('da055555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'Pacientsky portál', 'project', '#8b5cf6'),
  ('da066666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'Urgentné', 'custom', '#dc2626'),
  ('da077777-7777-7777-7777-777777777777', 'b1111111-1111-1111-1111-111111111111', 'Mesačný paušál', 'custom', '#06b6d4')
ON CONFLICT (organization_id, name, tag_type) DO NOTHING;

-- Tag assignments
INSERT INTO public.entity_tags (tag_id, entity_type, entity_id)
VALUES
  ('da011111-1111-1111-1111-111111111111', 'invoice', 'f1111111-1111-1111-1111-111111111111'),
  ('da011111-1111-1111-1111-111111111111', 'invoice', 'f4444444-4444-4444-4444-444444444444'),
  ('da022222-2222-2222-2222-222222222222', 'invoice', 'f2222222-2222-2222-2222-222222222222'),
  ('da022222-2222-2222-2222-222222222222', 'invoice', 'f6666666-6666-6666-6666-666666666666'),
  ('da033333-3333-3333-3333-333333333333', 'invoice', 'f3333333-3333-3333-3333-333333333333'),
  ('da044444-4444-4444-4444-444444444444', 'invoice', 'f2222222-2222-2222-2222-222222222222'),
  ('da044444-4444-4444-4444-444444444444', 'invoice', 'f6666666-6666-6666-6666-666666666666'),
  ('da055555-5555-5555-5555-555555555555', 'invoice', 'f3333333-3333-3333-3333-333333333333'),
  ('da066666-6666-6666-6666-666666666666', 'invoice', 'f4444444-4444-4444-4444-444444444444'),
  ('da077777-7777-7777-7777-777777777777', 'document', 'dc111111-1111-1111-1111-111111111111')
ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING;

-- =============================================================
-- 13. NOTIFICATIONS
-- =============================================================
INSERT INTO public.notifications (id, organization_id, user_id, type, title, body, entity_type, entity_id, is_read, metadata)
VALUES
  ('10111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   'invoice_overdue', 'Faktúra po splatnosti', 'FV-2026004 pre GreenEnergy a.s. je po splatnosti od 15.02.2026',
   'invoice', 'f4444444-4444-4444-4444-444444444444', FALSE,
   '{"invoice_number": "FV-2026004", "days_overdue": 28, "amount": 2280.00}'::jsonb),

  ('10222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222',
   'document_ocr_done', 'OCR spracovanie dokončené', 'Dokument cloudhost-faktura-mar-2026.pdf bol úspešne spracovaný',
   'document', 'dc777777-7777-7777-7777-777777777777', FALSE,
   '{"document_name": "cloudhost-faktura-mar-2026.pdf", "confidence": 0.94}'::jsonb),

  ('10333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   'reconciliation_match', 'Nová zhoda platby', 'Platba 4 080,00 € bola automaticky spárovaná s FV-2026001',
   'invoice', 'f1111111-1111-1111-1111-111111111111', TRUE,
   '{"invoice_number": "FV-2026001", "amount": 4080.00}'::jsonb),

  ('10444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   'system', 'Vitajte vo VEXERA', 'Vaša organizácia TechFlow s.r.o. je pripravená na používanie.',
   NULL, NULL, TRUE,
   '{"type": "welcome"}'::jsonb),

  ('10555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222',
   'document_ocr_done', 'OCR spracovanie dokončené', 'Dokument bloček-kancelária-feb.jpg bol spracovaný',
   'document', 'dc444444-4444-4444-4444-444444444444', FALSE,
   '{"document_name": "bloček-kancelária-feb.jpg", "confidence": 0.78}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 14. RULES (Auto-categorization)
-- =============================================================
INSERT INTO public.rules (id, organization_id, name, target_entity, conditions, actions, is_active, priority, logic_operator, applied_count)
VALUES
  ('a0111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'CloudHost → hosting', 'document',
   '[{"field": "supplier_name", "operator": "contains", "value": "CloudHost"}]'::jsonb,
   '[{"type": "set_category", "value": "hosting"}, {"type": "set_account", "value": "518"}]'::jsonb,
   TRUE, 10, 'AND', 3),

  ('a0222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'OfficeSupply → kancelárske', 'document',
   '[{"field": "supplier_name", "operator": "contains", "value": "OfficeSupply"}]'::jsonb,
   '[{"type": "set_category", "value": "kancelárske potreby"}, {"type": "set_account", "value": "501"}]'::jsonb,
   TRUE, 20, 'AND', 1),

  ('a0333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'Telekom → telekomunikácie', 'bank_transaction',
   '[{"field": "counterpart_name", "operator": "contains", "value": "Telekom"}]'::jsonb,
   '[{"type": "set_category", "value": "telekomunikácie"}]'::jsonb,
   TRUE, 30, 'AND', 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 15. JOURNAL ENTRIES & LEDGER ENTRIES (Double-entry bookkeeping)
-- =============================================================

-- Get chart_of_accounts IDs for system accounts
-- We need accounts: 311 (Pohľadávky), 321 (Záväzky), 343 (DPH), 602 (Tržby za služby), 518 (Ostatné služby), 501 (Spotreba materiálu), 221 (Bankové účty)

-- Journal entry for FV-2026001 (issued invoice to GreenEnergy - paid)
INSERT INTO public.journal_entries (id, organization_id, entry_number, entry_date, description, invoice_id, status, created_by, posted_by, posted_at)
VALUES
  ('ae111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'JE-2026-001', '2026-01-15', 'FV-2026001 - TechFlow → GreenEnergy a.s.',
   'f1111111-1111-1111-1111-111111111111', 'posted',
   'a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-01-15 10:00:00+01'),

  ('ae222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'JE-2026-002', '2026-01-25', 'Úhrada FV-2026001 - bankový prevod',
   'f1111111-1111-1111-1111-111111111111', 'posted',
   'a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-01-25 11:00:00+01'),

  -- Journal entry for FV-2026002 (issued to AutoDom - paid)
  ('ae333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'JE-2026-003', '2026-01-20', 'FV-2026002 - TechFlow → AutoDom Slovakia',
   'f2222222-2222-2222-2222-222222222222', 'posted',
   'a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-01-20 09:00:00+01'),

  -- Journal entry for DF-2026001 (received from CloudHost - paid)
  ('ae444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111',
   'JE-2026-004', '2026-01-01', 'DF-2026001 - CloudHost → TechFlow (hosting)',
   'f7777777-7777-7777-7777-777777777777', 'posted',
   'a2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', '2026-01-01 08:00:00+01'),

  -- Draft journal entry
  ('ae555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111',
   'JE-2026-005', '2026-03-01', 'FV-2026005 - TechFlow → DigitalAgency (draft)',
   'f5555555-5555-5555-5555-555555555555', 'draft',
   'a1111111-1111-1111-1111-111111111111', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Ledger entries (double-entry lines for journal entries)
INSERT INTO public.ledger_entries (id, organization_id, journal_entry_id, entry_date, description, debit_account_number, credit_account_number, amount, currency, status)
VALUES
  -- JE-001: Invoice issued → Debit 311 (Receivables), Credit 602 (Revenue)
  ('1e111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ae111111-1111-1111-1111-111111111111',
   '2026-01-15', 'FV-2026001 základ', '311', '602', 3400.00, 'EUR', 'posted'),
  -- JE-001: VAT → Debit 311 (Receivables), Credit 343 (VAT payable)
  ('1e222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'ae111111-1111-1111-1111-111111111111',
   '2026-01-15', 'FV-2026001 DPH 20%', '311', '343', 680.00, 'EUR', 'posted'),

  -- JE-002: Payment received → Debit 221 (Bank), Credit 311 (Receivables)
  ('1e333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'ae222222-2222-2222-2222-222222222222',
   '2026-01-25', 'Úhrada FV-2026001', '221', '311', 4080.00, 'EUR', 'posted'),

  -- JE-003: Invoice issued to AutoDom
  ('1e444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'ae333333-3333-3333-3333-333333333333',
   '2026-01-20', 'FV-2026002 základ', '311', '602', 5500.00, 'EUR', 'posted'),
  ('1e555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'ae333333-3333-3333-3333-333333333333',
   '2026-01-20', 'FV-2026002 DPH 20%', '311', '343', 1100.00, 'EUR', 'posted'),

  -- JE-004: Received invoice from CloudHost → Debit 518 (Services), Credit 321 (Payables)
  ('1e666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'ae444444-4444-4444-4444-444444444444',
   '2026-01-01', 'DF-2026001 základ', '518', '321', 450.00, 'EUR', 'posted'),
  ('1e777777-7777-7777-7777-777777777777', 'b1111111-1111-1111-1111-111111111111', 'ae444444-4444-4444-4444-444444444444',
   '2026-01-01', 'DF-2026001 DPH 20%', '343', '321', 90.00, 'EUR', 'posted'),

  -- JE-005: Draft entry
  ('1e888888-8888-8888-8888-888888888888', 'b1111111-1111-1111-1111-111111111111', 'ae555555-5555-5555-5555-555555555555',
   '2026-03-01', 'FV-2026005 základ (draft)', '311', '602', 4250.00, 'EUR', 'draft'),
  ('1e999999-9999-9999-9999-999999999999', 'b1111111-1111-1111-1111-111111111111', 'ae555555-5555-5555-5555-555555555555',
   '2026-03-01', 'FV-2026005 DPH 20% (draft)', '311', '343', 850.00, 'EUR', 'draft')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 16. INVOICE PAYMENTS
-- =============================================================
INSERT INTO public.invoice_payments (id, organization_id, invoice_id, amount, payment_date, payment_method, bank_transaction_id)
VALUES
  ('1a111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111',
   4080.00, '2026-01-25', 'bank_transfer', 'b1011111-1111-1111-1111-111111111111'),
  ('1a222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222',
   6600.00, '2026-01-31', 'bank_transfer', 'b2022222-2222-2222-2222-222222222222'),
  ('1a333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'f7777777-7777-7777-7777-777777777777',
   540.00, '2026-01-10', 'bank_transfer', 'b3033333-3333-3333-3333-333333333333'),
  ('1a444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'f8888888-8888-8888-8888-888888888888',
   294.00, '2026-01-28', 'bank_transfer', 'b4044444-4444-4444-4444-444444444444'),
  ('1a555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'f9999999-9999-9999-9999-999999999999',
   540.00, '2026-02-12', 'bank_transfer', 'b5055555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 17. RECURRING PATTERNS (detected spending patterns)
-- =============================================================
INSERT INTO public.recurring_patterns (id, organization_id, counterpart_name, counterpart_iban, typical_amount, amount_stddev, direction, frequency_days, last_seen_at, next_expected_at, occurrence_count, category)
VALUES
  ('aa111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'CloudHost s.r.o.', 'SK8811000000004455667788', 540.00, 0.00, 'outflow', 30,
   '2026-03-01', '2026-04-01', 3, 'hosting'),
  ('aa222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111',
   'Tatra banka a.s.', NULL, 9.90, 0.00, 'outflow', 30,
   '2026-02-28', '2026-03-31', 2, 'bankové poplatky'),
  ('aa333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111',
   'O2 Slovakia s.r.o.', 'SK1234560000009999888877', 89.50, 5.20, 'outflow', 30,
   '2026-02-15', '2026-03-15', 1, 'telekomunikácie')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 18. CHAT SESSIONS (AI assistant history)
-- =============================================================
INSERT INTO public.chat_sessions (id, user_id, organization_id, title)
VALUES
  ('c5111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'Prehľad tržieb za január')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.chat_messages (id, session_id, role, content, metadata)
VALUES
  ('c0111111-1111-1111-1111-111111111111', 'c5111111-1111-1111-1111-111111111111',
   'user', 'Aké boli naše tržby za január 2026?', NULL),
  ('c0222222-2222-2222-2222-222222222222', 'c5111111-1111-1111-1111-111111111111',
   'assistant', 'V januári 2026 mala vaša organizácia TechFlow s.r.o. celkové tržby vo výške 10 680,00 € (vrátane DPH). Boli vystavené 2 faktúry:\n\n1. FV-2026001 pre GreenEnergy a.s. - 4 080,00 € (uhradená)\n2. FV-2026002 pre AutoDom Slovakia s.r.o. - 6 600,00 € (uhradená)\n\nObe faktúry boli uhradené v riadnom termíne.',
   '{"sources": ["f1111111-1111-1111-1111-111111111111", "f2222222-2222-2222-2222-222222222222"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 19. ORGANIZATION LEDGER SETTINGS
-- =============================================================
INSERT INTO public.organization_ledger_settings (organization_id)
VALUES
  ('b1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 20. SUBSCRIPTIONS
-- =============================================================
INSERT INTO public.subscriptions (id, organization_id, stripe_customer_id, stripe_subscription_id, plan, status)
VALUES
  ('50111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'cus_mock_techflow_001', 'sub_mock_techflow_001', 'small_business', 'active'),
  ('50222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222',
   'cus_mock_novak_001', 'sub_mock_novak_001', 'freelancer', 'active')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================
-- Summary of mock data created:
-- =============================================================
-- 3 users (jan.novak, maria.kovacova, peter.horvath) — password: password123
-- 2 organizations (TechFlow s.r.o., Ján Novák - IT Konzultácie)
-- 4 org memberships
-- 6 contacts (3 clients, 2 suppliers, 1 both)
-- 6 products/services
-- 11 invoices (6 issued, 5 received) with 30 line items
-- 3 bank accounts with 11 transactions
-- 7 documents
-- 7 tags with 10 tag assignments
-- 5 notifications
-- 3 auto-categorization rules
-- 5 journal entries with 9 ledger entries
-- 5 invoice payments
-- 3 recurring patterns
-- 1 chat session with 2 messages
-- 2 subscriptions
