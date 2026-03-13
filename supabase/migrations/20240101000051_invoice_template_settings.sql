ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_template_settings JSONB
  NOT NULL DEFAULT '{
    "logoPosition": "left",
    "accentColor": "#111111",
    "font": "default",
    "footerText": "",
    "showBankDetails": true,
    "showQrCode": true,
    "showNotes": true,
    "showSignatureLines": true,
    "headerLayout": "side-by-side"
  }'::jsonb;
