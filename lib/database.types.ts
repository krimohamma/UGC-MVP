/**
 * Generated from the live Supabase project (pzhjujuyjaxkqsueqivg) — do not
 * hand-edit. Regenerate after any schema migration:
 *
 *   npx supabase gen types typescript --linked > lib/database.types.ts
 *   # or, from a direct connection string:
 *   npx supabase gen types typescript --db-url "<connection-string>" > lib/database.types.ts
 *   # or, via the claude.ai Supabase connector's generate_typescript_types tool.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brand_profiles: {
        Row: {
          created_at: string
          store_name: string
          store_niche_id: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          store_name: string
          store_niche_id?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          store_name?: string
          store_niche_id?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_store_niche_id_fkey"
            columns: ["store_niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          brand_id: string
          created_at: string
          creator_id: string
          id: string
          last_message_at: string | null
          order_id: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          creator_id: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          created_at: string
          creator_id: string
          id: string
          is_default: boolean
          method: Database["public"]["Enums"]["payout_method"]
        }
        Insert: {
          account_holder_name: string
          account_number: string
          created_at?: string
          creator_id: string
          id?: string
          is_default?: boolean
          method: Database["public"]["Enums"]["payout_method"]
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          created_at?: string
          creator_id?: string
          id?: string
          is_default?: boolean
          method?: Database["public"]["Enums"]["payout_method"]
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_accounts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          bio: string | null
          completed_orders_count: number
          created_at: string
          niche_id: string | null
          rating_avg: number
          rating_count: number
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          completed_orders_count?: number
          created_at?: string
          niche_id?: string | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          completed_orders_count?: number
          created_at?: string
          niche_id?: string | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_wallets: {
        Row: {
          available_balance_dzd: number
          creator_id: string
          pending_balance_dzd: number
          updated_at: string
        }
        Insert: {
          available_balance_dzd?: number
          creator_id: string
          pending_balance_dzd?: number
          updated_at?: string
        }
        Update: {
          available_balance_dzd?: number
          creator_id?: string
          pending_balance_dzd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_wallets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          order_id: string
          raised_by: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          raised_by: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          raised_by?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_languages: {
        Row: {
          gig_id: string
          language_code: string
        }
        Insert: {
          gig_id: string
          language_code: string
        }
        Update: {
          gig_id?: string
          language_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_languages_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_languages_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      gig_packages: {
        Row: {
          created_at: string
          delivery_days: number
          description: string
          features: string[]
          gig_id: string
          id: string
          price_dzd: number
          revisions_included: number
          tier: Database["public"]["Enums"]["package_tier"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_days: number
          description: string
          features?: string[]
          gig_id: string
          id?: string
          price_dzd: number
          revisions_included?: number
          tier: Database["public"]["Enums"]["package_tier"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_days?: number
          description?: string
          features?: string[]
          gig_id?: string
          id?: string
          price_dzd?: number
          revisions_included?: number
          tier?: Database["public"]["Enums"]["package_tier"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_packages_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          avg_rating: number
          base_price_dzd: number
          cover_media_url: string | null
          created_at: string
          creator_id: string
          description: string
          id: string
          niche_id: string
          orders_count: number
          status: Database["public"]["Enums"]["gig_status"]
          title: string
          updated_at: string
        }
        Insert: {
          avg_rating?: number
          base_price_dzd: number
          cover_media_url?: string | null
          created_at?: string
          creator_id: string
          description: string
          id?: string
          niche_id: string
          orders_count?: number
          status?: Database["public"]["Enums"]["gig_status"]
          title: string
          updated_at?: string
        }
        Update: {
          avg_rating?: number
          base_price_dzd?: number
          cover_media_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          niche_id?: string
          orders_count?: number
          status?: Database["public"]["Enums"]["gig_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          name_ar: string
          name_en: string
          name_fr: string
        }
        Insert: {
          code: string
          name_ar: string
          name_en: string
          name_fr: string
        }
        Update: {
          code?: string
          name_ar?: string
          name_en?: string
          name_fr?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          name_fr: string
          slug: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          name_fr: string
          slug: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          name_fr?: string
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_deliverables: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          note: string | null
          order_id: string
          revision_round: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          note?: string | null
          order_id: string
          revision_round?: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          note?: string | null
          order_id?: string
          revision_round?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliverables_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          brand_id: string
          cancelled_at: string | null
          commission_amount_dzd: number
          commission_rate: number
          completed_at: string | null
          created_at: string
          creator_id: string
          creator_payout_dzd: number
          delivered_at: string | null
          due_at: string | null
          gig_id: string
          gig_package_id: string
          id: string
          price_dzd: number
          requirements: string | null
          revisions_included: number
          revisions_used: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          brand_id: string
          cancelled_at?: string | null
          commission_amount_dzd: number
          commission_rate: number
          completed_at?: string | null
          created_at?: string
          creator_id: string
          creator_payout_dzd: number
          delivered_at?: string | null
          due_at?: string | null
          gig_id: string
          gig_package_id: string
          id?: string
          price_dzd: number
          requirements?: string | null
          revisions_included: number
          revisions_used?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          brand_id?: string
          cancelled_at?: string | null
          commission_amount_dzd?: number
          commission_rate?: number
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          creator_payout_dzd?: number
          delivered_at?: string | null
          due_at?: string | null
          gig_id?: string
          gig_package_id?: string
          id?: string
          price_dzd?: number
          requirements?: string | null
          revisions_included?: number
          revisions_used?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_gig_package_id_fkey"
            columns: ["gig_package_id"]
            isOneToOne: false
            referencedRelation: "gig_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_dzd: number
          creator_id: string
          id: string
          payout_account_id: string
          processed_at: string | null
          processed_by: string | null
          proof_image_url: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount_dzd: number
          creator_id: string
          id?: string
          payout_account_id: string
          processed_at?: string | null
          processed_by?: string | null
          proof_image_url?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount_dzd?: number
          creator_id?: string
          id?: string
          payout_account_id?: string
          processed_at?: string | null
          processed_by?: string | null
          proof_image_url?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "creator_payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string
          creator_id: string
          external_url: string | null
          id: string
          sort_order: number
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          external_url?: string | null
          id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          external_url?: string | null
          id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          direction: Database["public"]["Enums"]["review_direction"]
          id: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["review_direction"]
          id?: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["review_direction"]
          id?: string
          order_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_dzd: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          order_id: string | null
          payment_method: Database["public"]["Enums"]["payout_method"] | null
          payout_id: string | null
          proof_image_url: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount_dzd: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_id?: string | null
          proof_image_url?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount_dzd?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          payment_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_id?: string | null
          proof_image_url?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_verified: boolean
          locale: Database["public"]["Enums"]["locale"]
          password_hash: string
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          locale?: Database["public"]["Enums"]["locale"]
          password_hash: string
          phone_number?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          locale?: Database["public"]["Enums"]["locale"]
          password_hash?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_escrow_payment: {
        Args: { p_admin_id: string; p_transaction_id: string }
        Returns: undefined
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      release_escrow_payment: {
        Args: { p_admin_id: string; p_transaction_id: string }
        Returns: undefined
      }
    }
    Enums: {
      dispute_status: "open" | "resolved"
      gig_status: "draft" | "active" | "paused" | "archived"
      locale: "fr" | "ar" | "en"
      order_status:
        | "pending_payment"
        | "in_progress"
        | "pending_admin_review"
        | "delivered"
        | "revision_requested"
        | "completed"
        | "cancelled"
        | "disputed"
      package_tier: "basic" | "standard" | "premium"
      payout_method: "ccp" | "baridimob"
      payout_status: "pending" | "processing" | "paid" | "rejected"
      review_direction: "brand_to_creator" | "creator_to_brand"
      transaction_status: "pending" | "confirmed" | "rejected"
      transaction_type:
        | "escrow_hold"
        | "escrow_release"
        | "refund"
        | "commission"
        | "payout"
      user_role: "creator" | "brand" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      dispute_status: ["open", "resolved"],
      gig_status: ["draft", "active", "paused", "archived"],
      locale: ["fr", "ar", "en"],
      order_status: [
        "pending_payment",
        "in_progress",
        "pending_admin_review",
        "delivered",
        "revision_requested",
        "completed",
        "cancelled",
        "disputed",
      ],
      package_tier: ["basic", "standard", "premium"],
      payout_method: ["ccp", "baridimob"],
      payout_status: ["pending", "processing", "paid", "rejected"],
      review_direction: ["brand_to_creator", "creator_to_brand"],
      transaction_status: ["pending", "confirmed", "rejected"],
      transaction_type: [
        "escrow_hold",
        "escrow_release",
        "refund",
        "commission",
        "payout",
      ],
      user_role: ["creator", "brand", "admin"],
    },
  },
} as const
