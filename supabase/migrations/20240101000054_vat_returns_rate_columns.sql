-- Rename VAT rate columns to match 2025+ Slovak rates (23%, 19%, 5%)
-- Old rates were 20%, 10%, 5%

ALTER TABLE vat_returns RENAME COLUMN vat_output_20 TO vat_output_23;
ALTER TABLE vat_returns RENAME COLUMN vat_output_10 TO vat_output_19;
ALTER TABLE vat_returns RENAME COLUMN vat_input_20  TO vat_input_23;
ALTER TABLE vat_returns RENAME COLUMN vat_input_10  TO vat_input_19;
