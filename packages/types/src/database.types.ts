export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          ico: string
          dic: string | null
          ic_dph: string | null
          address_street: string | null
          address_city: string | null
          address_zip: string | null
          address_country: string
          phone: string | null
          email: string | null
          website: string | null
          bank_iban: string | null
          bank_swift: string | null
          logo_url: string | null
          logo_path: string | null
          subscription_plan: string
          organization_type: string
          storage_used_bytes: number
          peppol_endpoint_id: string | null
          peppol_scheme: string | null
          filing_frequency: string
          invoice_template_settings: Json
          dismissed_recurring_patterns: Json
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          ico: string
          dic?: string | null
          ic_dph?: string | null
          address_street?: string | null
          address_city?: string | null
          address_zip?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          website?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          logo_url?: string | null
          logo_path?: string | null
          subscription_plan?: string
          organization_type?: string
          storage_used_bytes?: number
          peppol_endpoint_id?: string | null
          peppol_scheme?: string | null
          filing_frequency?: string
          invoice_template_settings?: Json
          dismissed_recurring_patterns?: Json
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          ico?: string
          dic?: string | null
          ic_dph?: string | null
          address_street?: string | null
          address_city?: string | null
          address_zip?: string | null
          address_country?: string
          phone?: string | null
          email?: string | null
          website?: string | null
          bank_iban?: string | null
          bank_swift?: string | null
          logo_url?: string | null
          logo_path?: string | null
          subscription_plan?: string
          organization_type?: string
          storage_used_bytes?: number
          peppol_endpoint_id?: string | null
          peppol_scheme?: string | null
          filing_frequency?: string
          invoice_template_settings?: Json
          dismissed_recurring_patterns?: Json
          deleted_at?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          organization_id?: string
          user_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          invited_by: string
          invited_email: string
          role: string
          token: string
          status: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invited_by: string
          invited_email: string
          role: string
          token?: string
          status?: string
          expires_at?: string
          created_at?: string
        }
        Update: {
          status?: string
        }
        Relationships: []
      }
      accountant_clients: {
        Row: {
          id: string
          accountant_id: string
          organization_id: string
          invitation_id: string | null
          status: string
          permissions: Json
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          accountant_id: string
          organization_id: string
          invitation_id?: string | null
          status?: string
          permissions?: Json
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          permissions?: Json
          revoked_at?: string | null
        }
        Relationships: []
      }
      freelancer_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          tax_regime: string
          registered_dph: boolean
          is_first_year: boolean
          founding_date: string | null
          has_social_insurance: boolean
          paid_social_monthly: number | null
          is_disabled: boolean
          is_student: boolean
          is_pensioner: boolean
          has_other_employment: boolean
          paid_health_monthly: number | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          tax_regime: string
          registered_dph?: boolean
          is_first_year?: boolean
          founding_date?: string | null
          has_social_insurance?: boolean
          paid_social_monthly?: number | null
          is_disabled?: boolean
          is_student?: boolean
          is_pensioner?: boolean
          has_other_employment?: boolean
          paid_health_monthly?: number | null
          created_at?: string
        }
        Update: {
          ico?: string | null
          tax_regime?: string
          registered_dph?: boolean
          is_first_year?: boolean
          founding_date?: string | null
          has_social_insurance?: boolean
          paid_social_monthly?: number | null
          is_disabled?: boolean
          is_student?: boolean
          is_pensioner?: boolean
          has_other_employment?: boolean
          paid_health_monthly?: number | null
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          ic_dph: string | null
          dph_status: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          ic_dph?: string | null
          dph_status: string
          created_at?: string
        }
        Update: {
          ico?: string | null
          ic_dph?: string | null
          dph_status?: string
        }
        Relationships: []
      }
      accounting_firm_profiles: {
        Row: {
          id: string
          organization_id: string
          referral_code: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          referral_code?: string
          created_at?: string
        }
        Update: {
          referral_code?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          id: string
          organization_id: string | null
          account_number: string
          account_name: string
          account_class: string
          account_type: string
          parent_id: string | null
          is_active: boolean
          is_system: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          account_number: string
          account_name: string
          account_class: string
          account_type: string
          parent_id?: string | null
          is_active?: boolean
          is_system?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          account_number?: string
          account_name?: string
          account_class?: string
          account_type?: string
          parent_id?: string | null
          is_active?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          invoice_number: string
          invoice_type: string
          status: string
          supplier_name: string
          supplier_ico: string | null
          supplier_dic: string | null
          supplier_ic_dph: string | null
          supplier_address: string | null
          supplier_iban: string | null
          customer_name: string
          customer_ico: string | null
          customer_dic: string | null
          customer_ic_dph: string | null
          customer_address: string | null
          issue_date: string
          delivery_date: string | null
          due_date: string
          paid_at: string | null
          subtotal: number
          vat_amount: number
          total: number
          paid_amount: number
          remaining_amount: number | null
          currency: string
          payment_method: string | null
          bank_iban: string | null
          variable_symbol: string | null
          constant_symbol: string | null
          specific_symbol: string | null
          notes: string | null
          internal_notes: string | null
          file_path: string | null
          file_url: string | null
          peppol_id: string | null
          peppol_status: string | null
          peppol_sent_at: string | null
          contact_id: string | null
          credit_note_for_id: string | null
          closed_by: string | null
          closed_at: string | null
          created_by: string | null
          updated_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_number: string
          invoice_type: string
          status?: string
          supplier_name: string
          supplier_ico?: string | null
          supplier_dic?: string | null
          supplier_ic_dph?: string | null
          supplier_address?: string | null
          supplier_iban?: string | null
          customer_name: string
          customer_ico?: string | null
          customer_dic?: string | null
          customer_ic_dph?: string | null
          customer_address?: string | null
          issue_date: string
          delivery_date?: string | null
          due_date: string
          paid_at?: string | null
          subtotal: number
          vat_amount: number
          total: number
          paid_amount?: number
          remaining_amount?: number | null
          currency?: string
          payment_method?: string | null
          bank_iban?: string | null
          variable_symbol?: string | null
          constant_symbol?: string | null
          specific_symbol?: string | null
          notes?: string | null
          internal_notes?: string | null
          file_path?: string | null
          file_url?: string | null
          peppol_id?: string | null
          peppol_status?: string | null
          peppol_sent_at?: string | null
          contact_id?: string | null
          credit_note_for_id?: string | null
          closed_by?: string | null
          closed_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          invoice_number?: string
          invoice_type?: string
          status?: string
          supplier_name?: string
          supplier_ico?: string | null
          supplier_dic?: string | null
          supplier_ic_dph?: string | null
          supplier_address?: string | null
          supplier_iban?: string | null
          customer_name?: string
          customer_ico?: string | null
          customer_dic?: string | null
          customer_ic_dph?: string | null
          customer_address?: string | null
          issue_date?: string
          delivery_date?: string | null
          due_date?: string
          paid_at?: string | null
          subtotal?: number
          vat_amount?: number
          total?: number
          paid_amount?: number
          remaining_amount?: number | null
          currency?: string
          payment_method?: string | null
          bank_iban?: string | null
          variable_symbol?: string | null
          constant_symbol?: string | null
          specific_symbol?: string | null
          notes?: string | null
          internal_notes?: string | null
          file_path?: string | null
          file_url?: string | null
          peppol_id?: string | null
          peppol_status?: string | null
          peppol_sent_at?: string | null
          contact_id?: string | null
          credit_note_for_id?: string | null
          closed_by?: string | null
          closed_at?: string | null
          updated_by?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_credit_note_for_id_fkey"
            columns: ["credit_note_for_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit: string | null
          unit_price: number
          vat_rate: number
          vat_amount: number
          total: number
          sort_order: number
          product_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity: number
          unit?: string | null
          unit_price: number
          vat_rate: number
          vat_amount: number
          total: number
          sort_order?: number
          product_id?: string | null
          created_at?: string
        }
        Update: {
          description?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number
          vat_amount?: number
          total?: number
          sort_order?: number
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string
          amount: number
          currency: string
          payment_date: string
          payment_method: string | null
          reference: string | null
          bank_transaction_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id: string
          amount: number
          currency?: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          bank_transaction_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          currency?: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          bank_transaction_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string | null
          name: string
          file_path: string
          file_size_bytes: number | null
          mime_type: string | null
          checksum_sha256: string | null
          document_type: string | null
          retention_until: string
          is_archived: boolean
          ocr_status: string
          ocr_data: Json | null
          ocr_processed_at: string | null
          status: string
          supplier_name: string | null
          document_number: string | null
          issue_date: string | null
          due_date: string | null
          total_amount: number | null
          vat_amount: number | null
          vat_rate: number | null
          category: string | null
          account_number: string | null
          tag: string | null
          auto_categorized: boolean
          confidence_score: number | null
          file_hash: string | null
          uploaded_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id?: string | null
          name: string
          file_path: string
          file_size_bytes?: number | null
          mime_type?: string | null
          checksum_sha256?: string | null
          document_type?: string | null
          retention_until?: string
          is_archived?: boolean
          ocr_status?: string
          ocr_data?: Json | null
          ocr_processed_at?: string | null
          status?: string
          supplier_name?: string | null
          document_number?: string | null
          issue_date?: string | null
          due_date?: string | null
          total_amount?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
          category?: string | null
          account_number?: string | null
          tag?: string | null
          auto_categorized?: boolean
          confidence_score?: number | null
          file_hash?: string | null
          uploaded_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          invoice_id?: string | null
          name?: string
          file_path?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          checksum_sha256?: string | null
          document_type?: string | null
          retention_until?: string
          is_archived?: boolean
          ocr_status?: string
          ocr_data?: Json | null
          ocr_processed_at?: string | null
          status?: string
          supplier_name?: string | null
          document_number?: string | null
          issue_date?: string | null
          due_date?: string | null
          total_amount?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
          category?: string | null
          account_number?: string | null
          tag?: string | null
          auto_categorized?: boolean
          confidence_score?: number | null
          file_hash?: string | null
          uploaded_by?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          id: string
          document_id: string
          organization_id: string
          user_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          organization_id: string
          user_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_corrections: {
        Row: {
          id: string
          organization_id: string
          document_id: string
          user_id: string | null
          field_name: string
          old_value: string | null
          new_value: string
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          document_id: string
          user_id?: string | null
          field_name: string
          old_value?: string | null
          new_value: string
          source?: string
          created_at?: string
        }
        Update: {
          field_name?: string
          old_value?: string | null
          new_value?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_corrections_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string | null
          document_id: string | null
          journal_entry_id: string | null
          entry_date: string
          period_year: number
          period_month: number
          description: string
          reference_number: string | null
          debit_account_id: string | null
          credit_account_id: string | null
          debit_account_number: string
          credit_account_number: string
          account_id: string | null
          account_number_new: string | null
          amount: number
          debit_amount: number
          credit_amount: number
          currency: string
          status: string
          is_closing_entry: boolean
          reversed_by: string | null
          created_by: string | null
          posted_by: string | null
          posted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id?: string | null
          document_id?: string | null
          journal_entry_id?: string | null
          entry_date: string
          period_year: number
          period_month: number
          description: string
          reference_number?: string | null
          debit_account_id?: string | null
          credit_account_id?: string | null
          debit_account_number: string
          credit_account_number: string
          account_id?: string | null
          account_number_new?: string | null
          amount: number
          debit_amount?: number
          credit_amount?: number
          currency?: string
          status?: string
          is_closing_entry?: boolean
          reversed_by?: string | null
          created_by?: string | null
          posted_by?: string | null
          posted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          invoice_id?: string | null
          document_id?: string | null
          journal_entry_id?: string | null
          entry_date?: string
          period_year?: number
          period_month?: number
          description?: string
          reference_number?: string | null
          debit_account_id?: string | null
          credit_account_id?: string | null
          debit_account_number?: string
          credit_account_number?: string
          account_id?: string | null
          account_number_new?: string | null
          amount?: number
          debit_amount?: number
          credit_amount?: number
          currency?: string
          status?: string
          is_closing_entry?: boolean
          reversed_by?: string | null
          posted_by?: string | null
          posted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          id: string
          organization_id: string
          entry_number: string
          entry_date: string
          period_year: number
          period_month: number
          description: string
          reference_number: string | null
          invoice_id: string | null
          document_id: string | null
          status: string
          is_closing_entry: boolean
          reversed_by: string | null
          created_by: string | null
          posted_by: string | null
          posted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          entry_number: string
          entry_date: string
          description: string
          reference_number?: string | null
          invoice_id?: string | null
          document_id?: string | null
          status?: string
          is_closing_entry?: boolean
          reversed_by?: string | null
          created_by?: string | null
          posted_by?: string | null
          posted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          entry_number?: string
          entry_date?: string
          description?: string
          reference_number?: string | null
          invoice_id?: string | null
          document_id?: string | null
          status?: string
          is_closing_entry?: boolean
          reversed_by?: string | null
          posted_by?: string | null
          posted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          id: string
          organization_id: string
          bank_name: string
          iban: string
          swift: string | null
          currency: string
          account_holder: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          bank_name: string
          iban: string
          swift?: string | null
          currency?: string
          account_holder?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          bank_name?: string
          iban?: string
          swift?: string | null
          currency?: string
          account_holder?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          id: string
          organization_id: string
          bank_account_id: string
          transaction_date: string
          amount: number
          currency: string
          variable_symbol: string | null
          constant_symbol: string | null
          specific_symbol: string | null
          description: string | null
          counterpart_iban: string | null
          counterpart_name: string | null
          match_status: string
          matched_invoice_id: string | null
          matched_at: string | null
          matched_by: string | null
          source_file_name: string | null
          source_file_checksum: string | null
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          bank_account_id: string
          transaction_date: string
          amount: number
          currency?: string
          variable_symbol?: string | null
          constant_symbol?: string | null
          specific_symbol?: string | null
          description?: string | null
          counterpart_iban?: string | null
          counterpart_name?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          source_file_name?: string | null
          source_file_checksum?: string | null
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          transaction_date?: string
          amount?: number
          currency?: string
          variable_symbol?: string | null
          constant_symbol?: string | null
          specific_symbol?: string | null
          description?: string | null
          counterpart_iban?: string | null
          counterpart_name?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          matched_at?: string | null
          matched_by?: string | null
          source_file_name?: string | null
          source_file_checksum?: string | null
          external_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          is_active: boolean
          priority: number
          target_entity: string
          conditions: Json
          actions: Json
          logic_operator: string
          applied_count: number
          last_applied_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          is_active?: boolean
          priority?: number
          target_entity?: string
          conditions?: Json
          actions?: Json
          logic_operator?: string
          applied_count?: number
          last_applied_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          is_active?: boolean
          priority?: number
          target_entity?: string
          conditions?: Json
          actions?: Json
          logic_operator?: string
          applied_count?: number
          last_applied_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_applications: {
        Row: {
          id: string
          rule_id: string
          organization_id: string
          entity_type: string
          entity_id: string
          actions_applied: Json
          applied_at: string
        }
        Insert: {
          id?: string
          rule_id: string
          organization_id: string
          entity_type: string
          entity_id: string
          actions_applied: Json
          applied_at?: string
        }
        Update: {
          actions_applied?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rule_applications_rule_id_fkey"
            columns: ["rule_id"]
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          id: string
          organization_id: string
          created_by: string | null
          format: string
          period_from: string
          period_to: string
          include_types: string[]
          status: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          file_path: string | null
          row_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          created_by?: string | null
          format: string
          period_from: string
          period_to: string
          include_types?: string[]
          status?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          file_path?: string | null
          row_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          format?: string
          period_from?: string
          period_to?: string
          include_types?: string[]
          status?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          file_path?: string | null
          row_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connections: {
        Row: {
          id: string
          organization_id: string
          created_by: string | null
          email_address: string
          google_user_id: string
          access_token: string
          refresh_token: string
          token_expires_at: string
          is_active: boolean
          last_polled_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          created_by?: string | null
          email_address: string
          google_user_id: string
          access_token: string
          refresh_token: string
          token_expires_at: string
          is_active?: boolean
          last_polled_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email_address?: string
          google_user_id?: string
          access_token?: string
          refresh_token?: string
          token_expires_at?: string
          is_active?: boolean
          last_polled_at?: string | null
          last_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_connections_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_imports: {
        Row: {
          id: string
          organization_id: string
          email_connection_id: string
          gmail_message_id: string
          gmail_thread_id: string | null
          subject: string | null
          sender: string | null
          received_at: string | null
          attachments_found: number
          documents_created: number
          processed_at: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email_connection_id: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          subject?: string | null
          sender?: string | null
          received_at?: string | null
          attachments_found?: number
          documents_created?: number
          processed_at?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          gmail_thread_id?: string | null
          subject?: string | null
          sender?: string | null
          received_at?: string | null
          attachments_found?: number
          documents_created?: number
          error_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_imports_email_connection_id_fkey"
            columns: ["email_connection_id"]
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string | null
          recipient_email: string
          subject: string | null
          tracking_pixel_id: string
          status: string
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          open_count: number
          metadata: Json
          resend_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          invoice_id?: string | null
          recipient_email: string
          subject?: string | null
          tracking_pixel_id?: string
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          open_count?: number
          metadata?: Json
          resend_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          invoice_id?: string | null
          recipient_email?: string
          subject?: string | null
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          opened_at?: string | null
          open_count?: number
          metadata?: Json
          resend_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          type: string
          title: string
          body: string | null
          entity_type: string | null
          entity_id: string | null
          metadata: Json | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          type: string
          title: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          type?: string
          title?: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json | null
          is_read?: boolean
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          id: string
          organization_id: string
          name: string
          ico: string | null
          dic: string | null
          ic_dph: string | null
          contact_type: string
          street: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          email: string | null
          phone: string | null
          website: string | null
          bank_account: string | null
          is_key_client: boolean
          notes: string | null
          total_invoiced: number | null
          invoice_count: number | null
          avg_payment_days: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          ico?: string | null
          dic?: string | null
          ic_dph?: string | null
          contact_type?: string
          street?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          bank_account?: string | null
          is_key_client?: boolean
          notes?: string | null
          total_invoiced?: number | null
          invoice_count?: number | null
          avg_payment_days?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          ico?: string | null
          dic?: string | null
          ic_dph?: string | null
          contact_type?: string
          street?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          bank_account?: string | null
          is_key_client?: boolean
          notes?: string | null
          total_invoiced?: number | null
          invoice_count?: number | null
          avg_payment_days?: number | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          sku: string | null
          unit: string | null
          unit_price_net: number
          vat_rate: number
          currency: string
          total_revenue: number
          times_invoiced: number
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          sku?: string | null
          unit?: string | null
          unit_price_net: number
          vat_rate?: number
          currency?: string
          total_revenue?: number
          times_invoiced?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          sku?: string | null
          unit?: string | null
          unit_price_net?: number
          vat_rate?: number
          currency?: string
          total_revenue?: number
          times_invoiced?: number
          is_active?: boolean
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          tag_type: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          tag_type: string
          color?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          tag_type?: string
          color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          id: string
          tag_id: string
          entity_type: string
          entity_id: string
          created_at: string
        }
        Insert: {
          id?: string
          tag_id: string
          entity_type: string
          entity_id: string
          created_at?: string
        }
        Update: {
          tag_id?: string
          entity_type?: string
          entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_templates: {
        Row: {
          id: string
          organization_id: string
          template_name: string
          is_active: boolean
          invoice_type: string
          customer_name: string
          customer_ico: string | null
          customer_dic: string | null
          customer_ic_dph: string | null
          customer_address: string | null
          customer_email: string | null
          payment_method: string | null
          currency: string
          notes: string | null
          frequency: string
          interval_count: number
          day_of_month: number | null
          next_run_at: string
          last_run_at: string | null
          end_date: string | null
          items: Json
          auto_send: boolean
          send_to_email: string | null
          invoices_generated: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          template_name: string
          is_active?: boolean
          invoice_type?: string
          customer_name: string
          customer_ico?: string | null
          customer_dic?: string | null
          customer_ic_dph?: string | null
          customer_address?: string | null
          customer_email?: string | null
          payment_method?: string | null
          currency?: string
          notes?: string | null
          frequency: string
          interval_count?: number
          day_of_month?: number | null
          next_run_at: string
          last_run_at?: string | null
          end_date?: string | null
          items?: Json
          auto_send?: boolean
          send_to_email?: string | null
          invoices_generated?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          template_name?: string
          is_active?: boolean
          invoice_type?: string
          customer_name?: string
          customer_ico?: string | null
          customer_dic?: string | null
          customer_ic_dph?: string | null
          customer_address?: string | null
          customer_email?: string | null
          payment_method?: string | null
          currency?: string
          notes?: string | null
          frequency?: string
          interval_count?: number
          day_of_month?: number | null
          next_run_at?: string
          last_run_at?: string | null
          end_date?: string | null
          items?: Json
          auto_send?: boolean
          send_to_email?: string | null
          invoices_generated?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_templates_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_patterns: {
        Row: {
          id: string
          organization_id: string
          counterpart_name: string | null
          counterpart_iban: string | null
          typical_amount: number
          amount_stddev: number | null
          currency: string
          direction: string
          frequency_days: number
          last_seen_at: string | null
          next_expected_at: string | null
          occurrence_count: number
          is_active: boolean
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          counterpart_name?: string | null
          counterpart_iban?: string | null
          typical_amount: number
          amount_stddev?: number | null
          currency?: string
          direction: string
          frequency_days: number
          last_seen_at?: string | null
          next_expected_at?: string | null
          occurrence_count?: number
          is_active?: boolean
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          counterpart_name?: string | null
          counterpart_iban?: string | null
          typical_amount?: number
          amount_stddev?: number | null
          currency?: string
          direction?: string
          frequency_days?: number
          last_seen_at?: string | null
          next_expected_at?: string | null
          occurrence_count?: number
          is_active?: boolean
          category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_patterns_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_returns: {
        Row: {
          id: string
          organization_id: string
          period_year: number
          period_month: number
          vat_output_23: number
          vat_output_19: number
          vat_output_5: number
          vat_input_23: number
          vat_input_19: number
          vat_input_5: number
          total_output_vat: number
          total_input_vat: number
          vat_liability: number
          taxable_base_output: number
          taxable_base_input: number
          status: string
          document_count: number
          computed_at: string
          finalized_at: string | null
          finalized_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          period_year: number
          period_month: number
          vat_output_23?: number
          vat_output_19?: number
          vat_output_5?: number
          vat_input_23?: number
          vat_input_19?: number
          vat_input_5?: number
          total_output_vat?: number
          total_input_vat?: number
          vat_liability?: number
          taxable_base_output?: number
          taxable_base_input?: number
          status?: string
          document_count?: number
          computed_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          period_year?: number
          period_month?: number
          vat_output_23?: number
          vat_output_19?: number
          vat_output_5?: number
          vat_input_23?: number
          vat_input_19?: number
          vat_input_5?: number
          total_output_vat?: number
          total_input_vat?: number
          vat_liability?: number
          taxable_base_output?: number
          taxable_base_input?: number
          status?: string
          document_count?: number
          computed_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_returns_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          id: string
          organization_id: string | null
          job_type: string
          payload: Json
          status: string
          priority: number
          attempts: number
          max_attempts: number
          scheduled_at: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          result: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          job_type: string
          payload?: Json
          status?: string
          priority?: number
          attempts?: number
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          result?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          job_type?: string
          payload?: Json
          status?: string
          priority?: number
          attempts?: number
          max_attempts?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legislative_rules: {
        Row: {
          id: string
          country_code: string
          rule_type: string
          key: string
          value: Json
          valid_from: string
          valid_to: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          country_code?: string
          rule_type: string
          key: string
          value: Json
          valid_from: string
          valid_to?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          country_code?: string
          rule_type?: string
          key?: string
          value?: Json
          valid_from?: string
          valid_to?: string | null
          description?: string | null
        }
        Relationships: []
      }
      health_check_runs: {
        Row: {
          id: string
          organization_id: string
          triggered_by: string | null
          status: string
          total_issues: number | null
          critical_count: number | null
          warning_count: number | null
          info_count: number | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          triggered_by?: string | null
          status?: string
          total_issues?: number | null
          critical_count?: number | null
          warning_count?: number | null
          info_count?: number | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: string
          total_issues?: number | null
          critical_count?: number | null
          warning_count?: number | null
          info_count?: number | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_check_runs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check_results: {
        Row: {
          id: string
          organization_id: string
          check_run_id: string
          document_id: string | null
          invoice_id: string | null
          check_type: string
          severity: string
          message: string
          details: Json | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          check_run_id: string
          document_id?: string | null
          invoice_id?: string | null
          check_type: string
          severity: string
          message: string
          details?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
        }
        Update: {
          check_type?: string
          severity?: string
          message?: string
          details?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_check_results_check_run_id_fkey"
            columns: ["check_run_id"]
            referencedRelation: "health_check_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          event_name: string
          properties: Json | null
          session_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          event_name: string
          properties?: Json | null
          session_id?: string | null
          created_at?: string
        }
        Update: {
          event_name?: string
          properties?: Json | null
          session_id?: string | null
        }
        Relationships: []
      }
      report_snapshots: {
        Row: {
          id: string
          organization_id: string
          report_type: string
          period_from: string
          period_to: string
          parameters: Json | null
          data: Json
          generated_by: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          report_type: string
          period_from: string
          period_to: string
          parameters?: Json | null
          data: Json
          generated_by?: string | null
          generated_at?: string
        }
        Update: {
          report_type?: string
          period_from?: string
          period_to?: string
          parameters?: Json | null
          data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: string
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: string
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          role?: string
          content?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_policies: {
        Row: {
          id: string
          organization_id: string
          document_type: string
          retention_years: number
          auto_archive: boolean
          notify_before_expiry_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          document_type: string
          retention_years?: number
          auto_archive?: boolean
          notify_before_expiry_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          document_type?: string
          retention_years?: number
          auto_archive?: boolean
          notify_before_expiry_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "archive_policies_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_scenarios: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          name: string
          description: string | null
          color: string | null
          adjustments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          name: string
          description?: string | null
          color?: string | null
          adjustments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          color?: string | null
          adjustments?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          id: string
          organization_id: string
          year: number
          month: number
          status: string
          locked_at: string | null
          locked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          year: number
          month: number
          status?: string
          locked_at?: string | null
          locked_by?: string | null
          created_at?: string
        }
        Update: {
          year?: number
          month?: number
          status?: string
          locked_at?: string | null
          locked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_ledger_settings: {
        Row: {
          organization_id: string
          default_receivable_account: string
          default_payable_account: string
          default_revenue_account: string
          default_expense_account: string
          default_vat_output_account: string
          default_vat_input_account: string
          default_bank_account: string
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          default_receivable_account?: string
          default_payable_account?: string
          default_revenue_account?: string
          default_expense_account?: string
          default_vat_output_account?: string
          default_vat_input_account?: string
          default_bank_account?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          default_receivable_account?: string
          default_payable_account?: string
          default_revenue_account?: string
          default_expense_account?: string
          default_vat_output_account?: string
          default_vat_input_account?: string
          default_bank_account?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ledger_settings_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_data: Json | null
          new_data: Json | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: string
          status: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: string
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: string
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
