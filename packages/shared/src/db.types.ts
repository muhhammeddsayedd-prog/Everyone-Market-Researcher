export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  api: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      briefs_v: {
        Row: {
          body_md: string | null;
          created_at: string | null;
          highlights: Json | null;
          id: string | null;
          model: string | null;
          prompt_version: string | null;
          scope: string | null;
          source_item_ids: string[] | null;
          title: string | null;
          week_start: string | null;
        };
        ComputedFields: never;
        Insert: {
          body_md?: string | null;
          created_at?: string | null;
          highlights?: Json | null;
          id?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          scope?: string | null;
          source_item_ids?: string[] | null;
          title?: string | null;
          week_start?: string | null;
        };
        Update: {
          body_md?: string | null;
          created_at?: string | null;
          highlights?: Json | null;
          id?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          scope?: string | null;
          source_item_ids?: string[] | null;
          title?: string | null;
          week_start?: string | null;
        };
        Relationships: [];
      };
      campaigns_v: {
        Row: {
          agency_id: string | null;
          agency_name: string | null;
          agency_slug: string | null;
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          competitor_logo_path: string | null;
          competitor_name: string | null;
          competitor_slug: string | null;
          confidence: number | null;
          country: Database['app']['Enums']['country_code'] | null;
          created_at: string | null;
          first_seen_at: string | null;
          id: string | null;
          item_count: number | null;
          last_seen_at: string | null;
          locked_by_human: boolean | null;
          merged_into: string | null;
          occasion: string | null;
          platforms: Database['app']['Enums']['platform'][] | null;
          production_competitor_id: string | null;
          search_tsv: unknown;
          status: string | null;
          summary_ar: string | null;
          summary_en: string | null;
          title: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'items_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'items_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'organizations_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'items_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'items_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'organizations_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'items_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      competitors_v: {
        Row: {
          categories: string[] | null;
          company_code: string | null;
          hq_country: Database['app']['Enums']['country_code'] | null;
          id: string | null;
          in_house: string[] | null;
          is_baseline: boolean | null;
          logo_path: string | null;
          logo_url: string | null;
          markets: Database['app']['Enums']['country_code'][] | null;
          name: string | null;
          name_ar: string | null;
          pilot_rank: number | null;
          priority_tier: Database['app']['Enums']['priority_tier'] | null;
          slug: string | null;
          status: string | null;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          categories?: string[] | null;
          company_code?: string | null;
          hq_country?: Database['app']['Enums']['country_code'] | null;
          id?: string | null;
          in_house?: string[] | null;
          is_baseline?: boolean | null;
          logo_path?: string | null;
          logo_url?: string | null;
          markets?: Database['app']['Enums']['country_code'][] | null;
          name?: string | null;
          name_ar?: string | null;
          pilot_rank?: number | null;
          priority_tier?: Database['app']['Enums']['priority_tier'] | null;
          slug?: string | null;
          status?: string | null;
          website_url?: string | null;
        };
        Update: {
          categories?: string[] | null;
          company_code?: string | null;
          hq_country?: Database['app']['Enums']['country_code'] | null;
          id?: string | null;
          in_house?: string[] | null;
          is_baseline?: boolean | null;
          logo_path?: string | null;
          logo_url?: string | null;
          markets?: Database['app']['Enums']['country_code'][] | null;
          name?: string | null;
          name_ar?: string | null;
          pilot_rank?: number | null;
          priority_tier?: Database['app']['Enums']['priority_tier'] | null;
          slug?: string | null;
          status?: string | null;
          website_url?: string | null;
        };
        Relationships: [];
      };
      items_v: {
        Row: {
          agency_id: string | null;
          agency_name: string | null;
          agency_slug: string | null;
          ai_status: Database['app']['Enums']['ai_status'] | null;
          brand_id: string | null;
          brand_industry: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          campaign_id: string | null;
          caption_en: string | null;
          caption_original: string | null;
          competitor_id: string | null;
          competitor_logo_path: string | null;
          competitor_name: string | null;
          competitor_slug: string | null;
          confidence: number | null;
          content_type: string | null;
          country: Database['app']['Enums']['country_code'] | null;
          id: string | null;
          is_commercial_work: boolean | null;
          item_type: Database['app']['Enums']['item_type'] | null;
          metrics: Json | null;
          occasion: string | null;
          platform: Database['app']['Enums']['platform'] | null;
          priority_tier: Database['app']['Enums']['priority_tier'] | null;
          published_at: string | null;
          status: Database['app']['Enums']['item_status'] | null;
          summary_ar: string | null;
          summary_en: string | null;
          thumbnail_path: string | null;
          thumbnail_source_url: string | null;
          title: string | null;
          url: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
        ];
      };
      news_v: {
        Row: {
          created_at: string | null;
          id: string | null;
          kind: string | null;
          language: string | null;
          published_at: string | null;
          query: string | null;
          search_tsv: unknown;
          snippet: string | null;
          source_name: string | null;
          summary_en: string | null;
          title: string | null;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          id?: string | null;
          kind?: string | null;
          language?: string | null;
          published_at?: string | null;
          query?: string | null;
          search_tsv?: unknown;
          snippet?: string | null;
          source_name?: string | null;
          summary_en?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string | null;
          kind?: string | null;
          language?: string | null;
          published_at?: string | null;
          query?: string | null;
          search_tsv?: unknown;
          snippet?: string | null;
          source_name?: string | null;
          summary_en?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      organizations_v: {
        Row: {
          country: Database['app']['Enums']['country_code'] | null;
          id: string | null;
          industry: string | null;
          kind: Database['app']['Enums']['org_kind'] | null;
          logo_url: string | null;
          name: string | null;
          name_ar: string | null;
          seen_count: number | null;
          slug: string | null;
          status: Database['app']['Enums']['entity_status'] | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          country?: Database['app']['Enums']['country_code'] | null;
          id?: string | null;
          industry?: string | null;
          kind?: Database['app']['Enums']['org_kind'] | null;
          logo_url?: string | null;
          name?: string | null;
          name_ar?: string | null;
          seen_count?: number | null;
          slug?: string | null;
          status?: Database['app']['Enums']['entity_status'] | null;
          website?: string | null;
        };
        Update: {
          country?: Database['app']['Enums']['country_code'] | null;
          id?: string | null;
          industry?: string | null;
          kind?: Database['app']['Enums']['org_kind'] | null;
          logo_url?: string | null;
          name?: string | null;
          name_ar?: string | null;
          seen_count?: number | null;
          slug?: string | null;
          status?: Database['app']['Enums']['entity_status'] | null;
          website?: string | null;
        };
        Relationships: [];
      };
      people_v: {
        Row: {
          id: string | null;
          name: string | null;
          name_ar: string | null;
          primary_role: string | null;
          slug: string | null;
          status: Database['app']['Enums']['entity_status'] | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string | null;
          name?: string | null;
          name_ar?: string | null;
          primary_role?: string | null;
          slug?: string | null;
          status?: Database['app']['Enums']['entity_status'] | null;
        };
        Update: {
          id?: string | null;
          name?: string | null;
          name_ar?: string | null;
          primary_role?: string | null;
          slug?: string | null;
          status?: Database['app']['Enums']['entity_status'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  app: {
    Tables: {
      alert_rules: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          filters: NonNullable<Json>;
          id: number;
          kind: string;
          name: string;
          recipients: string[];
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          filters?: NonNullable<Json>;
          id?: never;
          kind: string;
          name: string;
          recipients: string[];
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          filters?: NonNullable<Json>;
          id?: never;
          kind?: string;
          name?: string;
          recipients?: string[];
        };
        Relationships: [];
      };
      allowed_domains: {
        Row: {
          created_at: string;
          domain: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          domain: string;
        };
        Update: {
          created_at?: string;
          domain?: string;
        };
        Relationships: [];
      };
      briefs: {
        Row: {
          body_md: string;
          created_at: string;
          highlights: NonNullable<Json>;
          id: string;
          model: string | null;
          prompt_version: string | null;
          scope: string;
          source_item_ids: string[];
          title: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          body_md: string;
          created_at?: string;
          highlights?: NonNullable<Json>;
          id?: string;
          model?: string | null;
          prompt_version?: string | null;
          scope: string;
          source_item_ids?: string[];
          title: string;
          week_start: string;
        };
        Update: {
          body_md?: string;
          created_at?: string;
          highlights?: NonNullable<Json>;
          id?: string;
          model?: string | null;
          prompt_version?: string | null;
          scope?: string;
          source_item_ids?: string[];
          title?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      campaign_items: {
        Row: {
          added_by: string;
          campaign_id: string;
          created_at: string;
          item_id: string;
          similarity: number | null;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string;
          campaign_id: string;
          created_at?: string;
          item_id: string;
          similarity?: number | null;
        };
        Update: {
          added_by?: string;
          campaign_id?: string;
          created_at?: string;
          item_id?: string;
          similarity?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: true;
            referencedRelation: 'feed_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: true;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          agency_id: string | null;
          brand_id: string | null;
          confidence: number | null;
          country: Database['app']['Enums']['country_code'] | null;
          created_at: string;
          first_seen_at: string;
          id: string;
          item_count: number;
          last_seen_at: string;
          locked_by_human: boolean;
          merged_into: string | null;
          occasion: string | null;
          platforms: Database['app']['Enums']['platform'][];
          production_competitor_id: string | null;
          search_tsv: unknown;
          status: string;
          summary_ar: string | null;
          summary_en: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id?: string | null;
          brand_id?: string | null;
          confidence?: number | null;
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          first_seen_at: string;
          id?: string;
          item_count?: number;
          last_seen_at: string;
          locked_by_human?: boolean;
          merged_into?: string | null;
          occasion?: string | null;
          platforms?: Database['app']['Enums']['platform'][];
          production_competitor_id?: string | null;
          search_tsv?: unknown;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          brand_id?: string | null;
          confidence?: number | null;
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          first_seen_at?: string;
          id?: string;
          item_count?: number;
          last_seen_at?: string;
          locked_by_human?: boolean;
          merged_into?: string | null;
          occasion?: string | null;
          platforms?: Database['app']['Enums']['platform'][];
          production_competitor_id?: string | null;
          search_tsv?: unknown;
          status?: string;
          summary_ar?: string | null;
          summary_en?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      competitor_accounts: {
        Row: {
          backfill_cursor: Json | null;
          backfill_from: string;
          backfill_status: Database['app']['Enums']['backfill_status'];
          cadence: string;
          competitor_id: string;
          consecutive_failures: number;
          created_at: string;
          external_id: string | null;
          handle: string;
          handle_norm: string | null;
          id: string;
          items_count: number;
          last_error: string | null;
          last_error_at: string | null;
          last_external_id: string | null;
          last_item_published_at: string | null;
          last_run_id: string | null;
          last_success_at: string | null;
          locked_until: string | null;
          next_due_at: string;
          platform: Database['app']['Enums']['platform'];
          resolve_status: string;
          status: Database['app']['Enums']['account_status'];
          updated_at: string;
          uploads_playlist_id: string | null;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          backfill_cursor?: Json | null;
          backfill_from?: string;
          backfill_status?: Database['app']['Enums']['backfill_status'];
          cadence?: string;
          competitor_id: string;
          consecutive_failures?: number;
          created_at?: string;
          external_id?: string | null;
          handle: string;
          handle_norm?: never;
          id?: string;
          items_count?: number;
          last_error?: string | null;
          last_error_at?: string | null;
          last_external_id?: string | null;
          last_item_published_at?: string | null;
          last_run_id?: string | null;
          last_success_at?: string | null;
          locked_until?: string | null;
          next_due_at?: string;
          platform: Database['app']['Enums']['platform'];
          resolve_status?: string;
          status?: Database['app']['Enums']['account_status'];
          updated_at?: string;
          uploads_playlist_id?: string | null;
          url: string;
        };
        Update: {
          backfill_cursor?: Json | null;
          backfill_from?: string;
          backfill_status?: Database['app']['Enums']['backfill_status'];
          cadence?: string;
          competitor_id?: string;
          consecutive_failures?: number;
          created_at?: string;
          external_id?: string | null;
          handle?: string;
          handle_norm?: never;
          id?: string;
          items_count?: number;
          last_error?: string | null;
          last_error_at?: string | null;
          last_external_id?: string | null;
          last_item_published_at?: string | null;
          last_run_id?: string | null;
          last_success_at?: string | null;
          locked_until?: string | null;
          next_due_at?: string;
          platform?: Database['app']['Enums']['platform'];
          resolve_status?: string;
          status?: Database['app']['Enums']['account_status'];
          updated_at?: string;
          uploads_playlist_id?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'competitor_accounts_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'competitor_accounts_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      competitors: {
        Row: {
          aliases: string[];
          categories: string[];
          company_code: string;
          created_at: string;
          hq_country: Database['app']['Enums']['country_code'] | null;
          id: string;
          in_house: string[];
          is_baseline: boolean;
          logo_path: string | null;
          logo_url: string | null;
          markets: Database['app']['Enums']['country_code'][];
          name: string;
          name_ar: string | null;
          notes: string | null;
          pilot_rank: number | null;
          priority_tier: Database['app']['Enums']['priority_tier'];
          search_tsv: unknown;
          slug: string;
          source_sheet_row: number | null;
          status: string;
          updated_at: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          categories?: string[];
          company_code: string;
          created_at?: string;
          hq_country?: Database['app']['Enums']['country_code'] | null;
          id?: string;
          in_house?: string[];
          is_baseline?: boolean;
          logo_path?: string | null;
          logo_url?: string | null;
          markets?: Database['app']['Enums']['country_code'][];
          name: string;
          name_ar?: string | null;
          notes?: string | null;
          pilot_rank?: number | null;
          priority_tier: Database['app']['Enums']['priority_tier'];
          search_tsv?: unknown;
          slug: string;
          source_sheet_row?: number | null;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          aliases?: string[];
          categories?: string[];
          company_code?: string;
          created_at?: string;
          hq_country?: Database['app']['Enums']['country_code'] | null;
          id?: string;
          in_house?: string[];
          is_baseline?: boolean;
          logo_path?: string | null;
          logo_url?: string | null;
          markets?: Database['app']['Enums']['country_code'][];
          name?: string;
          name_ar?: string | null;
          notes?: string | null;
          pilot_rank?: number | null;
          priority_tier?: Database['app']['Enums']['priority_tier'];
          search_tsv?: unknown;
          slug?: string;
          source_sheet_row?: number | null;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      embeddings: {
        Row: {
          content_hash: string;
          embedding: string;
          entity_id: string;
          entity_type: string;
          id: number;
          model: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash: string;
          embedding: string;
          entity_id: string;
          entity_type: string;
          id?: never;
          model: string;
          updated_at?: string;
        };
        Update: {
          content_hash?: string;
          embedding?: string;
          entity_id?: string;
          entity_type?: string;
          id?: never;
          model?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_snapshots: {
        Row: {
          account_id: string | null;
          competitor_id: string;
          coverage: NonNullable<Json>;
          created_at: string;
          headcount_listed: number;
          id: number;
          joined: NonNullable<Json>;
          left_company: NonNullable<Json>;
          people: NonNullable<Json>;
          snapshot_date: string;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          competitor_id: string;
          coverage?: NonNullable<Json>;
          created_at?: string;
          headcount_listed: number;
          id?: never;
          joined?: NonNullable<Json>;
          left_company?: NonNullable<Json>;
          people?: NonNullable<Json>;
          snapshot_date: string;
        };
        Update: {
          account_id?: string | null;
          competitor_id?: string;
          coverage?: NonNullable<Json>;
          created_at?: string;
          headcount_listed?: number;
          id?: never;
          joined?: NonNullable<Json>;
          left_company?: NonNullable<Json>;
          people?: NonNullable<Json>;
          snapshot_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_snapshots_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'competitor_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_snapshots_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_snapshots_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      item_credits: {
        Row: {
          competitor_id: string | null;
          confidence: number | null;
          created_at: string;
          id: number;
          item_id: string;
          organization_id: string | null;
          person_id: string | null;
          person_name_raw: string;
          role: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          competitor_id?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: never;
          item_id: string;
          organization_id?: string | null;
          person_id?: string | null;
          person_name_raw: string;
          role: string;
          source?: string;
        };
        Update: {
          competitor_id?: string | null;
          confidence?: number | null;
          created_at?: string;
          id?: never;
          item_id?: string;
          organization_id?: string | null;
          person_id?: string | null;
          person_name_raw?: string;
          role?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'item_credits_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'item_credits_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
          {
            foreignKeyName: 'item_credits_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'item_credits_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'item_credits_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'item_credits_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'item_credits_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'item_credits_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id'];
          },
        ];
      };
      items: {
        Row: {
          account_id: string | null;
          agency_id: string | null;
          ai_status: Database['app']['Enums']['ai_status'];
          brand_id: string | null;
          campaign_title: string | null;
          caption_en: string | null;
          caption_original: string | null;
          competitor_id: string;
          confidence: number | null;
          content_hash: string | null;
          content_type: string | null;
          country: Database['app']['Enums']['country_code'] | null;
          created_at: string;
          duplicate_of: string | null;
          duration_seconds: number | null;
          evidence: NonNullable<Json>;
          external_id: string;
          field_confidence: NonNullable<Json>;
          first_seen_at: string;
          hashtags: string[];
          id: string;
          is_commercial_work: boolean | null;
          item_type: Database['app']['Enums']['item_type'];
          language: string | null;
          last_extraction_id: number | null;
          locked_fields: string[];
          mentions: string[];
          metrics: NonNullable<Json>;
          metrics_updated_at: string | null;
          occasion: string | null;
          platform: Database['app']['Enums']['platform'];
          production_competitor_id: string | null;
          published_at: string | null;
          removed_detected_at: string | null;
          search_tsv: unknown;
          status: Database['app']['Enums']['item_status'];
          summary_ar: string | null;
          summary_en: string | null;
          tagged_accounts: string[];
          tags: string[];
          thumbnail_path: string | null;
          thumbnail_source_url: string | null;
          title: string | null;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          agency_id?: string | null;
          ai_status?: Database['app']['Enums']['ai_status'];
          brand_id?: string | null;
          campaign_title?: string | null;
          caption_en?: string | null;
          caption_original?: string | null;
          competitor_id: string;
          confidence?: number | null;
          content_hash?: string | null;
          content_type?: string | null;
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          duplicate_of?: string | null;
          duration_seconds?: number | null;
          evidence?: NonNullable<Json>;
          external_id: string;
          field_confidence?: NonNullable<Json>;
          first_seen_at?: string;
          hashtags?: string[];
          id?: string;
          is_commercial_work?: boolean | null;
          item_type: Database['app']['Enums']['item_type'];
          language?: string | null;
          last_extraction_id?: number | null;
          locked_fields?: string[];
          mentions?: string[];
          metrics?: NonNullable<Json>;
          metrics_updated_at?: string | null;
          occasion?: string | null;
          platform: Database['app']['Enums']['platform'];
          production_competitor_id?: string | null;
          published_at?: string | null;
          removed_detected_at?: string | null;
          search_tsv?: unknown;
          status?: Database['app']['Enums']['item_status'];
          summary_ar?: string | null;
          summary_en?: string | null;
          tagged_accounts?: string[];
          tags?: string[];
          thumbnail_path?: string | null;
          thumbnail_source_url?: string | null;
          title?: string | null;
          updated_at?: string;
          url: string;
        };
        Update: {
          account_id?: string | null;
          agency_id?: string | null;
          ai_status?: Database['app']['Enums']['ai_status'];
          brand_id?: string | null;
          campaign_title?: string | null;
          caption_en?: string | null;
          caption_original?: string | null;
          competitor_id?: string;
          confidence?: number | null;
          content_hash?: string | null;
          content_type?: string | null;
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          duplicate_of?: string | null;
          duration_seconds?: number | null;
          evidence?: NonNullable<Json>;
          external_id?: string;
          field_confidence?: NonNullable<Json>;
          first_seen_at?: string;
          hashtags?: string[];
          id?: string;
          is_commercial_work?: boolean | null;
          item_type?: Database['app']['Enums']['item_type'];
          language?: string | null;
          last_extraction_id?: number | null;
          locked_fields?: string[];
          mentions?: string[];
          metrics?: NonNullable<Json>;
          metrics_updated_at?: string | null;
          occasion?: string | null;
          platform?: Database['app']['Enums']['platform'];
          production_competitor_id?: string | null;
          published_at?: string | null;
          removed_detected_at?: string | null;
          search_tsv?: unknown;
          status?: Database['app']['Enums']['item_status'];
          summary_ar?: string | null;
          summary_en?: string | null;
          tagged_accounts?: string[];
          tags?: string[];
          thumbnail_path?: string | null;
          thumbnail_source_url?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'items_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'competitor_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'items_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'items_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'items_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'items_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
          {
            foreignKeyName: 'items_duplicate_of_fkey';
            columns: ['duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_duplicate_of_fkey';
            columns: ['duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      media_assets: {
        Row: {
          competitor_id: string | null;
          created_at: string;
          height: number | null;
          id: number;
          item_id: string | null;
          kind: string;
          source_url: string | null;
          storage_path: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          competitor_id?: string | null;
          created_at?: string;
          height?: number | null;
          id?: never;
          item_id?: string | null;
          kind: string;
          source_url?: string | null;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          competitor_id?: string | null;
          created_at?: string;
          height?: number | null;
          id?: never;
          item_id?: string | null;
          kind?: string;
          source_url?: string | null;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_assets_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_assets_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
          {
            foreignKeyName: 'media_assets_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_assets_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      member_invites: {
        Row: {
          created_at: string;
          email: string;
          invited_by: string | null;
          role: Database['app']['Enums']['member_role'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          invited_by?: string | null;
          role?: Database['app']['Enums']['member_role'];
        };
        Update: {
          created_at?: string;
          email?: string;
          invited_by?: string | null;
          role?: Database['app']['Enums']['member_role'];
        };
        Relationships: [];
      };
      members: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          invited_by: string | null;
          last_seen_at: string | null;
          role: Database['app']['Enums']['member_role'];
          status: Database['app']['Enums']['member_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          invited_by?: string | null;
          last_seen_at?: string | null;
          role?: Database['app']['Enums']['member_role'];
          status?: Database['app']['Enums']['member_status'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          invited_by?: string | null;
          last_seen_at?: string | null;
          role?: Database['app']['Enums']['member_role'];
          status?: Database['app']['Enums']['member_status'];
          user_id?: string;
        };
        Relationships: [];
      };
      news_articles: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          language: string | null;
          published_at: string | null;
          query: string | null;
          search_tsv: unknown;
          snippet: string | null;
          source_name: string | null;
          summary_en: string | null;
          title: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          language?: string | null;
          published_at?: string | null;
          query?: string | null;
          search_tsv?: unknown;
          snippet?: string | null;
          source_name?: string | null;
          summary_en?: string | null;
          title: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          language?: string | null;
          published_at?: string | null;
          query?: string | null;
          search_tsv?: unknown;
          snippet?: string | null;
          source_name?: string | null;
          summary_en?: string | null;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      news_mentions: {
        Row: {
          article_id: string;
          entity_id: string;
          entity_type: string;
        };
        ComputedFields: never;
        Insert: {
          article_id: string;
          entity_id: string;
          entity_type: string;
        };
        Update: {
          article_id?: string;
          entity_id?: string;
          entity_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'news_mentions_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'news_articles';
            referencedColumns: ['id'];
          },
        ];
      };
      org_aliases: {
        Row: {
          alias: string;
          alias_normalized: string;
          created_at: string;
          id: number;
          org_id: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          alias_normalized: string;
          created_at?: string;
          id?: never;
          org_id: string;
          source?: string;
        };
        Update: {
          alias?: string;
          alias_normalized?: string;
          created_at?: string;
          id?: never;
          org_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'org_aliases_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'org_aliases_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'org_aliases_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          country: Database['app']['Enums']['country_code'] | null;
          created_at: string;
          id: string;
          industry: string | null;
          kind: Database['app']['Enums']['org_kind'];
          logo_url: string | null;
          merged_into: string | null;
          name: string;
          name_ar: string | null;
          search_tsv: unknown;
          seen_count: number;
          slug: string;
          status: Database['app']['Enums']['entity_status'];
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          id?: string;
          industry?: string | null;
          kind: Database['app']['Enums']['org_kind'];
          logo_url?: string | null;
          merged_into?: string | null;
          name: string;
          name_ar?: string | null;
          search_tsv?: unknown;
          seen_count?: number;
          slug: string;
          status?: Database['app']['Enums']['entity_status'];
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          country?: Database['app']['Enums']['country_code'] | null;
          created_at?: string;
          id?: string;
          industry?: string | null;
          kind?: Database['app']['Enums']['org_kind'];
          logo_url?: string | null;
          merged_into?: string | null;
          name?: string;
          name_ar?: string | null;
          search_tsv?: unknown;
          seen_count?: number;
          slug?: string;
          status?: Database['app']['Enums']['entity_status'];
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'organizations_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'organizations_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      people: {
        Row: {
          created_at: string;
          id: string;
          linkedin_public_id: string | null;
          merged_into: string | null;
          name: string;
          name_ar: string | null;
          primary_role: string | null;
          search_tsv: unknown;
          slug: string;
          status: Database['app']['Enums']['entity_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          linkedin_public_id?: string | null;
          merged_into?: string | null;
          name: string;
          name_ar?: string | null;
          primary_role?: string | null;
          search_tsv?: unknown;
          slug: string;
          status?: Database['app']['Enums']['entity_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          linkedin_public_id?: string | null;
          merged_into?: string | null;
          name?: string;
          name_ar?: string | null;
          primary_role?: string | null;
          search_tsv?: unknown;
          slug?: string;
          status?: Database['app']['Enums']['entity_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'people_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id'];
          },
        ];
      };
      person_aliases: {
        Row: {
          alias: string;
          alias_normalized: string;
          id: number;
          person_id: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          alias_normalized: string;
          id?: never;
          person_id: string;
          source?: string;
        };
        Update: {
          alias?: string;
          alias_normalized?: string;
          id?: never;
          person_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'person_aliases_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'people';
            referencedColumns: ['id'];
          },
        ];
      };
      review_tasks: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: number;
          kind: Database['app']['Enums']['review_kind'];
          priority: number;
          reason: string | null;
          resolution: Json | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['app']['Enums']['review_status'];
          suggestion: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: never;
          kind: Database['app']['Enums']['review_kind'];
          priority?: number;
          reason?: string | null;
          resolution?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['app']['Enums']['review_status'];
          suggestion?: NonNullable<Json>;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: never;
          kind?: Database['app']['Enums']['review_kind'];
          priority?: number;
          reason?: string | null;
          resolution?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['app']['Enums']['review_status'];
          suggestion?: NonNullable<Json>;
        };
        Relationships: [];
      };
      saved_views: {
        Row: {
          created_at: string;
          filters: NonNullable<Json>;
          id: number;
          name: string;
          path: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          filters?: NonNullable<Json>;
          id?: never;
          name: string;
          path: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          filters?: NonNullable<Json>;
          id?: never;
          name?: string;
          path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stats_daily: {
        Row: {
          campaigns_new: number;
          commercial_new: number;
          competitor_id: string;
          country: Database['app']['Enums']['country_code'] | null;
          day: string;
          items_new: number;
          platform: Database['app']['Enums']['platform'];
        };
        ComputedFields: never;
        Insert: {
          campaigns_new?: number;
          commercial_new?: number;
          competitor_id: string;
          country?: Database['app']['Enums']['country_code'] | null;
          day: string;
          items_new?: number;
          platform: Database['app']['Enums']['platform'];
        };
        Update: {
          campaigns_new?: number;
          commercial_new?: number;
          competitor_id?: string;
          country?: Database['app']['Enums']['country_code'] | null;
          day?: string;
          items_new?: number;
          platform?: Database['app']['Enums']['platform'];
        };
        Relationships: [
          {
            foreignKeyName: 'stats_daily_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stats_daily_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      taxonomy_terms: {
        Row: {
          active: boolean;
          code: string;
          id: number;
          label_ar: string | null;
          label_en: string;
          sort: number;
          taxonomy: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          id?: never;
          label_ar?: string | null;
          label_en: string;
          sort?: number;
          taxonomy: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          id?: never;
          label_ar?: string | null;
          label_en?: string;
          sort?: number;
          taxonomy?: string;
        };
        Relationships: [];
      };
      website_pages: {
        Row: {
          account_id: string;
          competitor_id: string;
          crawled_at: string | null;
          first_seen_at: string;
          id: string;
          item_id: string | null;
          last_seen_at: string;
          status: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          competitor_id: string;
          crawled_at?: string | null;
          first_seen_at?: string;
          id?: string;
          item_id?: string | null;
          last_seen_at?: string;
          status?: string;
          url: string;
        };
        Update: {
          account_id?: string;
          competitor_id?: string;
          crawled_at?: string | null;
          first_seen_at?: string;
          id?: string;
          item_id?: string | null;
          last_seen_at?: string;
          status?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'website_pages_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'competitor_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_pages_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_pages_competitor_id_fkey';
            columns: ['competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
          {
            foreignKeyName: 'website_pages_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'website_pages_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      campaigns_v: {
        Row: {
          agency_id: string | null;
          agency_name: string | null;
          agency_slug: string | null;
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          competitor_logo_path: string | null;
          competitor_name: string | null;
          competitor_slug: string | null;
          confidence: number | null;
          country: Database['app']['Enums']['country_code'] | null;
          created_at: string | null;
          first_seen_at: string | null;
          id: string | null;
          item_count: number | null;
          last_seen_at: string | null;
          locked_by_human: boolean | null;
          merged_into: string | null;
          occasion: string | null;
          platforms: Database['app']['Enums']['platform'][] | null;
          production_competitor_id: string | null;
          search_tsv: unknown;
          status: string | null;
          summary_ar: string | null;
          summary_en: string | null;
          title: string | null;
          updated_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['agency_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['brand_id'];
          },
          {
            foreignKeyName: 'campaigns_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'competitors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_production_competitor_id_fkey';
            columns: ['production_competitor_id'];
            isOneToOne: false;
            referencedRelation: 'feed_v';
            referencedColumns: ['competitor_id'];
          },
        ];
      };
      feed_v: {
        Row: {
          agency_id: string | null;
          agency_name: string | null;
          agency_slug: string | null;
          ai_status: Database['app']['Enums']['ai_status'] | null;
          brand_id: string | null;
          brand_industry: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          campaign_id: string | null;
          caption_en: string | null;
          caption_original: string | null;
          competitor_id: string | null;
          competitor_logo_path: string | null;
          competitor_name: string | null;
          competitor_slug: string | null;
          confidence: number | null;
          content_type: string | null;
          country: Database['app']['Enums']['country_code'] | null;
          id: string | null;
          is_commercial_work: boolean | null;
          item_type: Database['app']['Enums']['item_type'] | null;
          metrics: Json | null;
          occasion: string | null;
          platform: Database['app']['Enums']['platform'] | null;
          priority_tier: Database['app']['Enums']['priority_tier'] | null;
          published_at: string | null;
          status: Database['app']['Enums']['item_status'] | null;
          summary_ar: string | null;
          summary_en: string | null;
          thumbnail_path: string | null;
          thumbnail_source_url: string | null;
          title: string | null;
          url: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns_v';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      me: { Args: Record<PropertyKey, never>; Returns: Json };
      search: {
        Args: {
          p_embedding?: string;
          p_filters?: Json;
          p_limit?: number;
          p_query: string;
          p_types?: string[];
        };
        Returns: {
          entity_id: string;
          entity_type: string;
          score: number;
          subtitle: string;
          title: string;
        }[];
      };
      similar: {
        Args: { p_entity_id: string; p_entity_type: string; p_limit?: number };
        Returns: {
          distance: number;
          entity_id: string;
          entity_type: string;
        }[];
      };
    };
    Enums: {
      account_status: 'active' | 'paused' | 'failing' | 'invalid' | 'disabled';
      ai_status: 'pending' | 'processing' | 'published' | 'review' | 'skipped' | 'failed' | 'duplicate';
      backfill_status: 'pending' | 'running' | 'done' | 'failed' | 'not_applicable';
      country_code: 'EG' | 'KSA' | 'UAE' | 'OTHER';
      entity_status: 'confirmed' | 'unconfirmed' | 'merged';
      item_status: 'active' | 'removed';
      item_type:
        | 'video'
        | 'post'
        | 'reel'
        | 'carousel'
        | 'story'
        | 'project_page'
        | 'linkedin_post'
        | 'news_article'
        | 'award_entry';
      member_role: 'viewer' | 'analyst' | 'admin';
      member_status: 'invited' | 'active' | 'disabled';
      org_kind: 'brand' | 'agency' | 'post_house' | 'media' | 'other';
      platform:
        | 'vimeo'
        | 'instagram'
        | 'instagram_stories'
        | 'website'
        | 'website_work_page'
        | 'linkedin'
        | 'linkedin_employees'
        | 'youtube'
        | 'news';
      priority_tier: 'baseline' | 'pilot' | 'next_wave' | 'adjacent';
      review_kind:
        | 'item_low_confidence'
        | 'new_brand'
        | 'new_agency'
        | 'new_person'
        | 'campaign_merge'
        | 'entity_merge'
        | 'account_suggestion';
      review_status: 'open' | 'approved' | 'corrected' | 'rejected' | 'snoozed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  ingest: {
    Tables: {
      raw_items: {
        Row: {
          account_id: string | null;
          actor: string | null;
          content_hash: string | null;
          external_id: string;
          fetched_at: string;
          id: number;
          normalized: NonNullable<Json>;
          payload: NonNullable<Json>;
          platform: Database['app']['Enums']['platform'];
          run_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          actor?: string | null;
          content_hash?: string | null;
          external_id: string;
          fetched_at?: string;
          id?: never;
          normalized: NonNullable<Json>;
          payload: NonNullable<Json>;
          platform: Database['app']['Enums']['platform'];
          run_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          actor?: string | null;
          content_hash?: string | null;
          external_id?: string;
          fetched_at?: string;
          id?: never;
          normalized?: NonNullable<Json>;
          payload?: NonNullable<Json>;
          platform?: Database['app']['Enums']['platform'];
          run_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      upsert_raw_items: { Args: { p_account_id: string; p_items: Json; p_run_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  ops: {
    Tables: {
      ai_extractions: {
        Row: {
          confidence: number | null;
          cost_usd: number | null;
          created_at: string;
          id: number;
          input_tokens: number | null;
          item_id: string;
          latency_ms: number | null;
          model: string;
          output: NonNullable<Json>;
          output_tokens: number | null;
          prompt_version: string;
          schema_version: string;
          used_vision: boolean;
        };
        ComputedFields: never;
        Insert: {
          confidence?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          id?: never;
          input_tokens?: number | null;
          item_id: string;
          latency_ms?: number | null;
          model: string;
          output: NonNullable<Json>;
          output_tokens?: number | null;
          prompt_version: string;
          schema_version: string;
          used_vision?: boolean;
        };
        Update: {
          confidence?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          id?: never;
          input_tokens?: number | null;
          item_id?: string;
          latency_ms?: number | null;
          model?: string;
          output?: NonNullable<Json>;
          output_tokens?: number | null;
          prompt_version?: string;
          schema_version?: string;
          used_vision?: boolean;
        };
        Relationships: [];
      };
      api_calls: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          id: number;
          key_id: string | null;
          status: number;
          tool: string;
          transport: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          id?: never;
          key_id?: string | null;
          status: number;
          tool: string;
          transport: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          id?: never;
          key_id?: string | null;
          status?: number;
          tool?: string;
          transport?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_calls_key_id_fkey';
            columns: ['key_id'];
            isOneToOne: false;
            referencedRelation: 'api_keys';
            referencedColumns: ['id'];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          key_hash: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          rate_limit_per_min: number;
          revoked_at: string | null;
          scopes: string[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key_hash: string;
          last_used_at?: string | null;
          name: string;
          prefix: string;
          rate_limit_per_min?: number;
          revoked_at?: string | null;
          scopes: string[];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key_hash?: string;
          last_used_at?: string | null;
          name?: string;
          prefix?: string;
          rate_limit_per_min?: number;
          revoked_at?: string | null;
          scopes?: string[];
        };
        Relationships: [];
      };
      apify_launch_admissions: {
        Row: {
          account_id: string;
          actor_build: string;
          actor_id: string;
          apify_run_id: string | null;
          execution_id: string;
          input: NonNullable<Json>;
          launch_id: string;
          max_total_charge_usd: number;
          ordinal: number;
          post_intent_at: string;
          reconciled_at: string | null;
          run_id: string;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          actor_build: string;
          actor_id: string;
          apify_run_id?: string | null;
          execution_id: string;
          input: NonNullable<Json>;
          launch_id: string;
          max_total_charge_usd: number;
          ordinal: number;
          post_intent_at?: string;
          reconciled_at?: string | null;
          run_id: string;
          window_id: string;
        };
        Update: {
          account_id?: string;
          actor_build?: string;
          actor_id?: string;
          apify_run_id?: string | null;
          execution_id?: string;
          input?: NonNullable<Json>;
          launch_id?: string;
          max_total_charge_usd?: number;
          ordinal?: number;
          post_intent_at?: string;
          reconciled_at?: string | null;
          run_id?: string;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'apify_launch_admissions_apify_run_id_fkey';
            columns: ['apify_run_id'];
            isOneToOne: true;
            referencedRelation: 'apify_runs';
            referencedColumns: ['apify_run_id'];
          },
          {
            foreignKeyName: 'apify_launch_admissions_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: true;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'apify_launch_admissions_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'apify_launch_approvals';
            referencedColumns: ['window_id'];
          },
        ];
      };
      apify_launch_approvals: {
        Row: {
          actor_build: string;
          approval_reference: string;
          batch_max_usd: number;
          closed_at: string | null;
          expires_at: string;
          max_total_charge_usd: number;
          not_before: string;
          project_ref: string;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_build: string;
          approval_reference: string;
          batch_max_usd: number;
          closed_at?: string | null;
          expires_at: string;
          max_total_charge_usd: number;
          not_before: string;
          project_ref: string;
          window_id: string;
        };
        Update: {
          actor_build?: string;
          approval_reference?: string;
          batch_max_usd?: number;
          closed_at?: string | null;
          expires_at?: string;
          max_total_charge_usd?: number;
          not_before?: string;
          project_ref?: string;
          window_id?: string;
        };
        Relationships: [];
      };
      apify_runs: {
        Row: {
          account_ids: string[];
          actor_id: string;
          apify_run_id: string;
          dataset_id: string | null;
          finished_at: string | null;
          processed_at: string | null;
          processing_result: Json | null;
          purpose: string;
          run_id: string | null;
          started_at: string;
          status: string;
          usage_usd: number | null;
        };
        ComputedFields: never;
        Insert: {
          account_ids: string[];
          actor_id: string;
          apify_run_id: string;
          dataset_id?: string | null;
          finished_at?: string | null;
          processed_at?: string | null;
          processing_result?: Json | null;
          purpose: string;
          run_id?: string | null;
          started_at?: string;
          status?: string;
          usage_usd?: number | null;
        };
        Update: {
          account_ids?: string[];
          actor_id?: string;
          apify_run_id?: string;
          dataset_id?: string | null;
          finished_at?: string | null;
          processed_at?: string | null;
          processing_result?: Json | null;
          purpose?: string;
          run_id?: string | null;
          started_at?: string;
          status?: string;
          usage_usd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'apify_runs_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: string;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      bakeoff_observations: {
        Row: {
          account_id: string;
          actor: string;
          apify_run_id: string;
          created_at: string;
          day: string;
          error_code: string | null;
          login_prompt: boolean;
          observed_at: string;
          status: string;
          story_keys: string[];
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          actor: string;
          apify_run_id: string;
          created_at?: string;
          day: string;
          error_code?: string | null;
          login_prompt?: boolean;
          observed_at: string;
          status: string;
          story_keys?: string[];
        };
        Update: {
          account_id?: string;
          actor?: string;
          apify_run_id?: string;
          created_at?: string;
          day?: string;
          error_code?: string | null;
          login_prompt?: boolean;
          observed_at?: string;
          status?: string;
          story_keys?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'bakeoff_observations_apify_run_id_fkey';
            columns: ['apify_run_id'];
            isOneToOne: false;
            referencedRelation: 'apify_runs';
            referencedColumns: ['apify_run_id'];
          },
        ];
      };
      bakeoff_results: {
        Row: {
          account_id: string;
          actor: string;
          apify_run_id: string;
          created_at: string;
          day: string;
          has_link: boolean;
          has_mentions: boolean;
          has_thumbnail: boolean;
          id: number;
          raw_id: string;
          story_key: string;
          taken_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          actor: string;
          apify_run_id: string;
          created_at?: string;
          day: string;
          has_link: boolean;
          has_mentions: boolean;
          has_thumbnail: boolean;
          id?: never;
          raw_id: string;
          story_key: string;
          taken_at: string;
        };
        Update: {
          account_id?: string;
          actor?: string;
          apify_run_id?: string;
          created_at?: string;
          day?: string;
          has_link?: boolean;
          has_mentions?: boolean;
          has_thumbnail?: boolean;
          id?: never;
          raw_id?: string;
          story_key?: string;
          taken_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bakeoff_results_apify_run_id_account_id_fkey';
            columns: ['apify_run_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'bakeoff_observations';
            referencedColumns: ['apify_run_id', 'account_id'];
          },
        ];
      };
      collector_accounts: {
        Row: {
          account_id: string;
          context: NonNullable<Json>;
          run_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          context: NonNullable<Json>;
          run_id: string;
        };
        Update: {
          account_id?: string;
          context?: NonNullable<Json>;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collector_accounts_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'collector_runs';
            referencedColumns: ['run_id'];
          },
        ];
      };
      collector_launches: {
        Row: {
          account_ids: string[];
          actor_id: string;
          apify_run_id: string | null;
          approval_id: string;
          created_at: string;
          dataset_complete: boolean;
          launch_id: string;
          max_actor_starts: number;
          max_actor_usd: number;
          max_total_usd: number;
          next_offset: number;
          pass: string;
          purpose: string;
          results_limit: number;
          run_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_ids: string[];
          actor_id: string;
          apify_run_id?: string | null;
          approval_id: string;
          created_at?: string;
          dataset_complete?: boolean;
          launch_id: string;
          max_actor_starts: number;
          max_actor_usd: number;
          max_total_usd: number;
          next_offset?: number;
          pass: string;
          purpose: string;
          results_limit: number;
          run_id: string;
        };
        Update: {
          account_ids?: string[];
          actor_id?: string;
          apify_run_id?: string | null;
          approval_id?: string;
          created_at?: string;
          dataset_complete?: boolean;
          launch_id?: string;
          max_actor_starts?: number;
          max_actor_usd?: number;
          max_total_usd?: number;
          next_offset?: number;
          pass?: string;
          purpose?: string;
          results_limit?: number;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collector_launches_apify_run_id_fkey';
            columns: ['apify_run_id'];
            isOneToOne: true;
            referencedRelation: 'apify_runs';
            referencedColumns: ['apify_run_id'];
          },
          {
            foreignKeyName: 'collector_launches_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'collector_runs';
            referencedColumns: ['run_id'];
          },
        ];
      };
      collector_pages: {
        Row: {
          args_sha256: string;
          launch_id: string;
          page_offset: number;
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          args_sha256: string;
          launch_id: string;
          page_offset: number;
          result: NonNullable<Json>;
        };
        Update: {
          args_sha256?: string;
          launch_id?: string;
          page_offset?: number;
          result?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'collector_pages_launch_id_fkey';
            columns: ['launch_id'];
            isOneToOne: false;
            referencedRelation: 'collector_launches';
            referencedColumns: ['launch_id'];
          },
        ];
      };
      collector_passes: {
        Row: {
          account_id: string;
          backfill_cursor: Json | null;
          backfill_done: boolean;
          error: string | null;
          items_new: number;
          items_seen: number;
          launch_id: string | null;
          pass: string;
          run_id: string;
          source_evidence: boolean;
          stage_status: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          backfill_cursor?: Json | null;
          backfill_done?: boolean;
          error?: string | null;
          items_new?: number;
          items_seen?: number;
          launch_id?: string | null;
          pass: string;
          run_id: string;
          source_evidence?: boolean;
          stage_status?: string;
          status?: string;
        };
        Update: {
          account_id?: string;
          backfill_cursor?: Json | null;
          backfill_done?: boolean;
          error?: string | null;
          items_new?: number;
          items_seen?: number;
          launch_id?: string | null;
          pass?: string;
          run_id?: string;
          source_evidence?: boolean;
          stage_status?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collector_passes_launch_id_fkey';
            columns: ['launch_id'];
            isOneToOne: false;
            referencedRelation: 'collector_launches';
            referencedColumns: ['launch_id'];
          },
          {
            foreignKeyName: 'collector_passes_run_id_account_id_fkey';
            columns: ['run_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'collector_accounts';
            referencedColumns: ['run_id', 'account_id'];
          },
        ];
      };
      collector_requests: {
        Row: {
          args_sha256: string;
          created_at: string;
          operation: string;
          request_id: string;
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          args_sha256: string;
          created_at?: string;
          operation: string;
          request_id: string;
          result: NonNullable<Json>;
        };
        Update: {
          args_sha256?: string;
          created_at?: string;
          operation?: string;
          request_id?: string;
          result?: NonNullable<Json>;
        };
        Relationships: [];
      };
      collector_runs: {
        Row: {
          created_at: string;
          registration_closed: boolean;
          run_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          registration_closed?: boolean;
          run_id: string;
        };
        Update: {
          created_at?: string;
          registration_closed?: boolean;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collector_runs_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: true;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      cost_ledger: {
        Row: {
          category: string;
          competitor_id: string | null;
          cost_usd: number;
          created_at: string;
          day: string;
          id: number;
          item_id: string | null;
          meta: NonNullable<Json>;
          platform: Database['app']['Enums']['platform'] | null;
          provider: string;
          quantity: number;
          run_id: string | null;
          unit: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          competitor_id?: string | null;
          cost_usd: number;
          created_at?: string;
          day?: string;
          id?: never;
          item_id?: string | null;
          meta?: NonNullable<Json>;
          platform?: Database['app']['Enums']['platform'] | null;
          provider: string;
          quantity?: number;
          run_id?: string | null;
          unit: string;
        };
        Update: {
          category?: string;
          competitor_id?: string | null;
          cost_usd?: number;
          created_at?: string;
          day?: string;
          id?: never;
          item_id?: string | null;
          meta?: NonNullable<Json>;
          platform?: Database['app']['Enums']['platform'] | null;
          provider?: string;
          quantity?: number;
          run_id?: string | null;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cost_ledger_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      foundation_gateway_leases: {
        Row: {
          expires_at: string | null;
          request_id: string | null;
          slot: number;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          expires_at?: string | null;
          request_id?: string | null;
          slot: number;
          window_id: string;
        };
        Update: {
          expires_at?: string | null;
          request_id?: string | null;
          slot?: number;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'foundation_gateway_leases_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'foundation_gateway_rate_windows';
            referencedColumns: ['window_id'];
          },
          {
            foreignKeyName: 'foundation_gateway_leases_window_id_request_id_fkey';
            columns: ['window_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'foundation_gateway_requests';
            referencedColumns: ['window_id', 'request_id'];
          },
        ];
      };
      foundation_gateway_rate_windows: {
        Row: {
          admitted_count: number;
          bound_audience: string | null;
          bound_commit_sha: string | null;
          bound_deployment_id: string | null;
          close_count: number;
          closed_at: string | null;
          day_count: number;
          day_start: string | null;
          environment: string;
          expires_at: string | null;
          minute_count: number;
          minute_start: string | null;
          namespace: string;
          project_ref: string;
          starts_at: string | null;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          admitted_count?: number;
          bound_audience?: string | null;
          bound_commit_sha?: string | null;
          bound_deployment_id?: string | null;
          close_count?: number;
          closed_at?: string | null;
          day_count?: number;
          day_start?: string | null;
          environment: string;
          expires_at?: string | null;
          minute_count?: number;
          minute_start?: string | null;
          namespace: string;
          project_ref: string;
          starts_at?: string | null;
          window_id: string;
        };
        Update: {
          admitted_count?: number;
          bound_audience?: string | null;
          bound_commit_sha?: string | null;
          bound_deployment_id?: string | null;
          close_count?: number;
          closed_at?: string | null;
          day_count?: number;
          day_start?: string | null;
          environment?: string;
          expires_at?: string | null;
          minute_count?: number;
          minute_start?: string | null;
          namespace?: string;
          project_ref?: string;
          starts_at?: string | null;
          window_id?: string;
        };
        Relationships: [];
      };
      foundation_gateway_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          lease_expires_at: string;
          operation: string;
          payload_sha256: string;
          read_apify_run_id: string | null;
          read_launch_id: string | null;
          read_started: boolean;
          request_id: string;
          result: Json | null;
          state: string;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          lease_expires_at: string;
          operation: string;
          payload_sha256: string;
          read_apify_run_id?: string | null;
          read_launch_id?: string | null;
          read_started?: boolean;
          request_id: string;
          result?: Json | null;
          state: string;
          window_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          lease_expires_at?: string;
          operation?: string;
          payload_sha256?: string;
          read_apify_run_id?: string | null;
          read_launch_id?: string | null;
          read_started?: boolean;
          request_id?: string;
          result?: Json | null;
          state?: string;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'foundation_gateway_requests_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'foundation_gateway_rate_windows';
            referencedColumns: ['window_id'];
          },
        ];
      };
      foundation_gateway_run_bindings: {
        Row: {
          run_id: string;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          run_id: string;
          window_id: string;
        };
        Update: {
          run_id?: string;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'foundation_gateway_run_bindings_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: true;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'foundation_gateway_run_bindings_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'foundation_gateway_rate_windows';
            referencedColumns: ['window_id'];
          },
        ];
      };
      m05_jobs: {
        Row: {
          actor_input: NonNullable<Json>;
          crawler_type: string | null;
          launch_id: string;
          max_website_urls_per_account: number;
          result: Json | null;
          retry_of: string | null;
          retry_pending: boolean;
          settled: boolean;
          snapshot_date: string | null;
          urls: string[];
        };
        ComputedFields: never;
        Insert: {
          actor_input: NonNullable<Json>;
          crawler_type?: string | null;
          launch_id: string;
          max_website_urls_per_account?: number;
          result?: Json | null;
          retry_of?: string | null;
          retry_pending?: boolean;
          settled?: boolean;
          snapshot_date?: string | null;
          urls?: string[];
        };
        Update: {
          actor_input?: NonNullable<Json>;
          crawler_type?: string | null;
          launch_id?: string;
          max_website_urls_per_account?: number;
          result?: Json | null;
          retry_of?: string | null;
          retry_pending?: boolean;
          settled?: boolean;
          snapshot_date?: string | null;
          urls?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'm05_jobs_launch_id_fkey';
            columns: ['launch_id'];
            isOneToOne: true;
            referencedRelation: 'collector_launches';
            referencedColumns: ['launch_id'];
          },
          {
            foreignKeyName: 'm05_jobs_retry_of_fkey';
            columns: ['retry_of'];
            isOneToOne: true;
            referencedRelation: 'm05_jobs';
            referencedColumns: ['launch_id'];
          },
        ];
      };
      m05_quota: {
        Row: {
          quota_day: string;
          used_units: number;
        };
        ComputedFields: never;
        Insert: {
          quota_day: string;
          used_units?: number;
        };
        Update: {
          quota_day?: string;
          used_units?: number;
        };
        Relationships: [];
      };
      m06_story_jobs: {
        Row: {
          actor_input: NonNullable<Json>;
          build_id: string;
          collection_mode: string;
          created_at: string;
          launch_id: string;
          memory_mbytes: number;
          result: Json | null;
          settled: boolean;
          timeout_secs: number;
        };
        ComputedFields: never;
        Insert: {
          actor_input: NonNullable<Json>;
          build_id: string;
          collection_mode: string;
          created_at?: string;
          launch_id: string;
          memory_mbytes: number;
          result?: Json | null;
          settled?: boolean;
          timeout_secs: number;
        };
        Update: {
          actor_input?: NonNullable<Json>;
          build_id?: string;
          collection_mode?: string;
          created_at?: string;
          launch_id?: string;
          memory_mbytes?: number;
          result?: Json | null;
          settled?: boolean;
          timeout_secs?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'm06_story_jobs_launch_id_fkey';
            columns: ['launch_id'];
            isOneToOne: true;
            referencedRelation: 'collector_launches';
            referencedColumns: ['launch_id'];
          },
        ];
      };
      m06_story_runs: {
        Row: {
          collection_mode: string;
          run_id: string;
        };
        ComputedFields: never;
        Insert: {
          collection_mode: string;
          run_id: string;
        };
        Update: {
          collection_mode?: string;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'm06_story_runs_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: true;
            referencedRelation: 'collector_runs';
            referencedColumns: ['run_id'];
          },
        ];
      };
      price_book: {
        Row: {
          provider: string;
          sku: string;
          unit: string;
          usd_per_unit: number;
          valid_from: string;
        };
        ComputedFields: never;
        Insert: {
          provider: string;
          sku: string;
          unit: string;
          usd_per_unit: number;
          valid_from?: string;
        };
        Update: {
          provider?: string;
          sku?: string;
          unit?: string;
          usd_per_unit?: number;
          valid_from?: string;
        };
        Relationships: [];
      };
      scrape_run_accounts: {
        Row: {
          account_id: string;
          error: string | null;
          finished_at: string;
          items_new: number;
          items_seen: number;
          run_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          error?: string | null;
          finished_at?: string;
          items_new?: number;
          items_seen?: number;
          run_id: string;
          status: string;
        };
        Update: {
          account_id?: string;
          error?: string | null;
          finished_at?: string;
          items_new?: number;
          items_seen?: number;
          run_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scrape_run_accounts_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'scrape_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      scrape_runs: {
        Row: {
          accounts_failed: number;
          accounts_ok: number;
          accounts_total: number;
          cost_usd: number;
          env: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          items_new: number;
          items_seen: number;
          mode: string;
          n8n_execution_id: string | null;
          platform: Database['app']['Enums']['platform'] | null;
          started_at: string;
          status: string;
          workflow: string;
        };
        ComputedFields: never;
        Insert: {
          accounts_failed?: number;
          accounts_ok?: number;
          accounts_total?: number;
          cost_usd?: number;
          env: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          items_new?: number;
          items_seen?: number;
          mode?: string;
          n8n_execution_id?: string | null;
          platform?: Database['app']['Enums']['platform'] | null;
          started_at?: string;
          status?: string;
          workflow: string;
        };
        Update: {
          accounts_failed?: number;
          accounts_ok?: number;
          accounts_total?: number;
          cost_usd?: number;
          env?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          items_new?: number;
          items_seen?: number;
          mode?: string;
          n8n_execution_id?: string | null;
          platform?: Database['app']['Enums']['platform'] | null;
          started_at?: string;
          status?: string;
          workflow?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      worker_gateway_leases: {
        Row: {
          expires_at: string | null;
          request_id: string | null;
          slot: number;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          expires_at?: string | null;
          request_id?: string | null;
          slot: number;
          window_id: string;
        };
        Update: {
          expires_at?: string | null;
          request_id?: string | null;
          slot?: number;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_gateway_leases_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'worker_gateway_rate_windows';
            referencedColumns: ['window_id'];
          },
          {
            foreignKeyName: 'worker_gateway_leases_window_id_request_id_fkey';
            columns: ['window_id', 'request_id'];
            isOneToOne: false;
            referencedRelation: 'worker_gateway_requests';
            referencedColumns: ['window_id', 'request_id'];
          },
        ];
      };
      worker_gateway_rate_windows: {
        Row: {
          admitted_count: number;
          bound_audience: string | null;
          bound_commit_sha: string | null;
          bound_deployment_id: string | null;
          close_count: number;
          closed_at: string | null;
          day_count: number;
          day_start: string | null;
          environment: string;
          expires_at: string | null;
          minute_count: number;
          minute_start: string | null;
          namespace: string;
          project_ref: string;
          starts_at: string | null;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          admitted_count?: number;
          bound_audience?: string | null;
          bound_commit_sha?: string | null;
          bound_deployment_id?: string | null;
          close_count?: number;
          closed_at?: string | null;
          day_count?: number;
          day_start?: string | null;
          environment: string;
          expires_at?: string | null;
          minute_count?: number;
          minute_start?: string | null;
          namespace: string;
          project_ref: string;
          starts_at?: string | null;
          window_id: string;
        };
        Update: {
          admitted_count?: number;
          bound_audience?: string | null;
          bound_commit_sha?: string | null;
          bound_deployment_id?: string | null;
          close_count?: number;
          closed_at?: string | null;
          day_count?: number;
          day_start?: string | null;
          environment?: string;
          expires_at?: string | null;
          minute_count?: number;
          minute_start?: string | null;
          namespace?: string;
          project_ref?: string;
          starts_at?: string | null;
          window_id?: string;
        };
        Relationships: [];
      };
      worker_gateway_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          lease_expires_at: string;
          operation: string;
          payload_sha256: string;
          request_id: string;
          result: Json | null;
          state: string;
          window_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          lease_expires_at: string;
          operation: string;
          payload_sha256: string;
          request_id: string;
          result?: Json | null;
          state: string;
          window_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          lease_expires_at?: string;
          operation?: string;
          payload_sha256?: string;
          request_id?: string;
          result?: Json | null;
          state?: string;
          window_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_gateway_requests_window_id_fkey';
            columns: ['window_id'];
            isOneToOne: false;
            referencedRelation: 'worker_gateway_rate_windows';
            referencedColumns: ['window_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accrue_fixed_costs: { Args: { p_day: string }; Returns: number };
      ack_media_batch: { Args: { p_execution_id: string; p_msg_ids: number[] }; Returns: undefined };
      ack_queue: { Args: { p_msg_ids: number[]; p_queue: string }; Returns: undefined };
      ack_story_media_batch: { Args: { p_execution_id: string; p_msg_ids: number[] }; Returns: undefined };
      apify_runs_pending: { Args: { p_run_id: string }; Returns: number };
      authorize_apify_launch: { Args: { p: Json }; Returns: Json };
      claim_media_batch: { Args: { p_execution_id: string; p_limit?: number }; Returns: Json };
      claim_queue_batch: {
        Args: { p_n: number; p_queue: string; p_vt_seconds?: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
      claim_story_media_batch: { Args: { p_execution_id: string; p_limit?: number }; Returns: Json };
      collector_execute: { Args: { p_args: Json; p_operation: string; p_request_id: string }; Returns: Json };
      collector_finalize: { Args: { p_run_id: string }; Returns: Json };
      complete_apify_run: {
        Args: { p_apify_run_id: string; p_dataset_id: string; p_status: string; p_usage_usd: number };
        Returns: Json;
      };
      daily_health: { Args: Record<PropertyKey, never>; Returns: Json };
      diff_website_urls: { Args: { p_account_id: string; p_urls: string[] }; Returns: string[] };
      error_count_24h: { Args: { p_claim_notify?: boolean; p_workflow: string }; Returns: number };
      finish_media_batch: { Args: { p_execution_id: string }; Returns: Json };
      finish_run: { Args: { p_error?: string; p_run_id: string; p_status: string }; Returns: Json };
      finish_story_media_batch: { Args: { p_execution_id: string }; Returns: Json };
      foundation_gateway_admit: {
        Args: {
          p_args: Json;
          p_mode?: string;
          p_operation: string;
          p_request_id: string;
          p_window_id: string;
        };
        Returns: Json;
      };
      foundation_gateway_complete_read: {
        Args: { p_apify_run_id: string; p_request_id: string; p_result: Json; p_window_id: string };
        Returns: Json;
      };
      foundation_gateway_execute: {
        Args: { p_args: Json; p_operation: string; p_request_id: string; p_window_id: string };
        Returns: Json;
      };
      foundation_gateway_process: { Args: { p_args: Json; p_window_id: string }; Returns: Json };
      foundation_gateway_provision:
        | { Args: { p: Json }; Returns: undefined }
        | { Args: { p: Json; p_window_id: string }; Returns: undefined };
      foundation_gateway_read_context: {
        Args: { p_apify_run_id: string; p_request_id: string; p_window_id: string };
        Returns: Json;
      };
      foundation_gateway_registered: { Args: { p_apify_run_id: string; p_window_id: string }; Returns: Json };
      foundation_gateway_replay_costs: { Args: { p_entries: Json; p_window_id: string }; Returns: number };
      foundation_gateway_response: {
        Args: {
          p_code: string;
          p_operation: string;
          p_replayed?: boolean;
          p_result: Json;
          p_state: string;
          p_window_id: string;
        };
        Returns: Json;
      };
      foundation_gateway_status: {
        Args: { p_target_request_id: string; p_window_id: string };
        Returns: Json;
      };
      foundation_gateway_validate: {
        Args: { p_args: Json; p_operation: string; p_request_id: string; p_window_id: string };
        Returns: undefined;
      };
      foundation_gateway_workflow: { Args: { p: string }; Returns: boolean };
      get_apify_launch: { Args: { p_launch_id: string }; Returns: Json };
      get_apify_run: { Args: { p_apify_run_id: string }; Returns: Json };
      get_due_accounts: {
        Args: {
          p_limit: number;
          p_mode?: string;
          p_platform: Database['app']['Enums']['platform'];
          p_run_id: string;
        };
        Returns: {
          account_id: string;
          backfill_cursor: Json;
          backfill_from: string;
          competitor_id: string;
          competitor_slug: string;
          external_id: string;
          handle: string;
          uploads_playlist_id: string;
          url: string;
          watermark_external_id: string;
          watermark_published_at: string;
        }[];
      };
      get_items_for_ai: { Args: { p_item_ids: string[] }; Returns: Json };
      get_media_targets: { Args: { p_item_ids: string[] }; Returns: Json };
      get_price_book: { Args: Record<PropertyKey, never>; Returns: Json };
      get_setting: { Args: { p_key: string }; Returns: Json };
      log_cost: { Args: { p_entries: Json }; Returns: number };
      log_workflow_error: { Args: { p: Json }; Returns: undefined };
      m03_smoke_launch_input: { Args: Record<PropertyKey, never>; Returns: Json };
      m05_assert_claim: {
        Args: { p_account_id: string; p_run_id: string };
        Returns: Database['app']['Tables']['competitor_accounts']['Row'];
        SetofOptions: {
          from: '*';
          to: 'competitor_accounts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      m05_execute: { Args: { p_args: Json; p_operation: string; p_request_id: string }; Returns: Json };
      m05_finalize: { Args: { p_run_id: string }; Returns: Json };
      m05_resolve_youtube: {
        Args: { p_account_id: string; p_external_id: string; p_uploads_playlist_id: string };
        Returns: undefined;
      };
      m06_execute: { Args: { p_args: Json; p_operation: string; p_request_id: string }; Returns: Json };
      mark_website_page: {
        Args: { p_item_id?: string; p_status: string; p_url: string };
        Returns: undefined;
      };
      process_apify_run: {
        Args: {
          p_apify_run_id: string;
          p_dataset_id: string;
          p_groups: Json;
          p_status: string;
          p_usage_usd: number;
        };
        Returns: Json;
      };
      reconcile_apify_launch: { Args: { p: Json }; Returns: Json };
      record_media_outcome: { Args: { p_execution_id: string; p_outcome: Json }; Returns: undefined };
      record_story_media_outcome: { Args: { p_execution_id: string; p_outcome: Json }; Returns: undefined };
      register_apify_run: {
        Args: {
          p_account_ids: string[];
          p_actor_id: string;
          p_apify_run_id: string;
          p_purpose: string;
          p_run_id: string;
        };
        Returns: undefined;
      };
      reject_apify_callback: { Args: { p: Json }; Returns: Json };
      report_account_result: {
        Args: {
          p_account_id: string;
          p_backfill_cursor?: Json;
          p_backfill_done?: boolean;
          p_error?: string;
          p_items_new: number;
          p_items_seen: number;
          p_run_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      save_bakeoff_rows: { Args: { p_rows: Json }; Returns: number };
      save_employee_snapshot: {
        Args: { p_account_id: string; p_coverage?: Json; p_people: Json; p_snapshot_date: string };
        Returns: Json;
      };
      save_media_asset: {
        Args: {
          p_h: number;
          p_item_id: string;
          p_kind: string;
          p_path: string;
          p_source_url: string;
          p_w: number;
        };
        Returns: undefined;
      };
      set_account_external_id: {
        Args: { p_account_id: string; p_external_id: string; p_uploads_playlist_id?: string };
        Returns: undefined;
      };
      set_stories_cadence: { Args: { p_twice_daily: boolean }; Returns: Json };
      start_run: {
        Args: {
          p_env: string;
          p_execution_id: string;
          p_mode: string;
          p_platform: Database['app']['Enums']['platform'];
          p_workflow: string;
        };
        Returns: string;
      };
      story_bakeoff_snapshot: {
        Args: { p_account_ids: string[]; p_from_day: string; p_to_day: string };
        Returns: Json;
      };
      worker_gateway_admit: {
        Args: {
          p_args: Json;
          p_mode?: string;
          p_operation: string;
          p_request_id: string;
          p_window_id: string;
        };
        Returns: Json;
      };
      worker_gateway_execute: {
        Args: { p_args: Json; p_operation: string; p_request_id: string; p_window_id: string };
        Returns: Json;
      };
      worker_gateway_response: {
        Args: { p_code: string; p_result: Json; p_state: string; p_window_id: string };
        Returns: Json;
      };
      worker_gateway_status: { Args: { p_target_request_id: string; p_window_id: string }; Returns: Json };
      worker_gateway_validate: {
        Args: { p_args: Json; p_operation: string; p_request_id: string; p_window_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  api: {
    Enums: {},
  },
  app: {
    Enums: {
      account_status: ['active', 'paused', 'failing', 'invalid', 'disabled'],
      ai_status: ['pending', 'processing', 'published', 'review', 'skipped', 'failed', 'duplicate'],
      backfill_status: ['pending', 'running', 'done', 'failed', 'not_applicable'],
      country_code: ['EG', 'KSA', 'UAE', 'OTHER'],
      entity_status: ['confirmed', 'unconfirmed', 'merged'],
      item_status: ['active', 'removed'],
      item_type: [
        'video',
        'post',
        'reel',
        'carousel',
        'story',
        'project_page',
        'linkedin_post',
        'news_article',
        'award_entry',
      ],
      member_role: ['viewer', 'analyst', 'admin'],
      member_status: ['invited', 'active', 'disabled'],
      org_kind: ['brand', 'agency', 'post_house', 'media', 'other'],
      platform: [
        'vimeo',
        'instagram',
        'instagram_stories',
        'website',
        'website_work_page',
        'linkedin',
        'linkedin_employees',
        'youtube',
        'news',
      ],
      priority_tier: ['baseline', 'pilot', 'next_wave', 'adjacent'],
      review_kind: [
        'item_low_confidence',
        'new_brand',
        'new_agency',
        'new_person',
        'campaign_merge',
        'entity_merge',
        'account_suggestion',
      ],
      review_status: ['open', 'approved', 'corrected', 'rejected', 'snoozed'],
    },
  },
  ingest: {
    Enums: {},
  },
  ops: {
    Enums: {},
  },
} as const;
