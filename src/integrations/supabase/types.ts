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
      chat_settings: {
        Row: {
          background_url: string | null
          chat_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_url?: string | null
          chat_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_url?: string | null
          chat_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      custom_emojis: {
        Row: {
          created_at: string
          id: string
          image_url: string
          owner_id: string
          pack_id: string | null
          shortcode: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          owner_id: string
          pack_id?: string | null
          shortcode: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          owner_id?: string
          pack_id?: string | null
          shortcode?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_emojis_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "emoji_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      emoji_packs: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_app_permissions: {
        Row: {
          app_id: string
          granted_at: string
          id: string
          user_id: string
          wallet_access: boolean
        }
        Insert: {
          app_id: string
          granted_at?: string
          id?: string
          user_id: string
          wallet_access?: boolean
        }
        Update: {
          app_id?: string
          granted_at?: string
          id?: string
          user_id?: string
          wallet_access?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mini_app_permissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "mini_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_apps: {
        Row: {
          app_url: string
          category: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          installs: number
          name: string
          owner_id: string
          reject_reason: string | null
          slug: string
          status: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          app_url: string
          category?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          installs?: number
          name: string
          owner_id: string
          reject_reason?: string | null
          slug: string
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          app_url?: string
          category?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          installs?: number
          name?: string
          owner_id?: string
          reject_reason?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title?: string
        }
        Relationships: []
      }
      partnership_agreements: {
        Row: {
          body: string
          content_hash: string
          created_at: string
          created_by: string
          doc_number: string
          id: string
          partnership_id: string
          version: number
        }
        Insert: {
          body: string
          content_hash: string
          created_at?: string
          created_by: string
          doc_number: string
          id?: string
          partnership_id: string
          version?: number
        }
        Update: {
          body?: string
          content_hash?: string
          created_at?: string
          created_by?: string
          doc_number?: string
          id?: string
          partnership_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "partnership_agreements_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_documents: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          file_url: string | null
          id: string
          kind: string
          partnership_id: string
          title: string
          version: number
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          file_url?: string | null
          id?: string
          kind?: string
          partnership_id: string
          title: string
          version?: number
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          file_url?: string | null
          id?: string
          kind?: string
          partnership_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "partnership_documents_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_finance: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          direction: string
          id: string
          note: string | null
          occurred_on: string
          partnership_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by: string
          direction?: string
          id?: string
          note?: string | null
          occurred_on?: string
          partnership_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          direction?: string
          id?: string
          note?: string | null
          occurred_on?: string
          partnership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_finance_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_followers: {
        Row: {
          created_at: string
          partnership_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          partnership_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          partnership_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_followers_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_join_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          partnership_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          partnership_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          partnership_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_join_requests_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string | null
          id: string
          partnership_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          partnership_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          partnership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_log_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_members: {
        Row: {
          id: string
          joined_at: string
          partnership_id: string
          role: string
          share: number
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          partnership_id: string
          role?: string
          share?: number
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          partnership_id?: string
          role?: string
          share?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_members_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          likes: number
          media_url: string | null
          partnership_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          likes?: number
          media_url?: string | null
          partnership_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          likes?: number
          media_url?: string | null
          partnership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_posts_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          partnership_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          partnership_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          partnership_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_projects_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_signatures: {
        Row: {
          agreement_id: string
          email: string
          full_name: string
          id: string
          signature_data: string | null
          signed_at: string
          user_id: string
        }
        Insert: {
          agreement_id: string
          email: string
          full_name: string
          id?: string
          signature_data?: string | null
          signed_at?: string
          user_id: string
        }
        Update: {
          agreement_id?: string
          email?: string
          full_name?: string
          id?: string
          signature_data?: string | null
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_signatures_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "partnership_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          done: boolean
          due_date: string | null
          id: string
          partnership_id: string
          project_id: string | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          done?: boolean
          due_date?: string | null
          id?: string
          partnership_id: string
          project_id?: string | null
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
          partnership_id?: string
          project_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_tasks_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "partnership_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          contacts: Json
          created_at: string
          created_by: string
          decision_rule: string
          description: string | null
          field: string
          followers_count: number
          founded_at: string
          goals: string | null
          id: string
          is_open: boolean
          language: string
          links: Json
          logo_url: string | null
          name: string
          reputation: number
          revenue_model: string
          slug: string
          updated_at: string
        }
        Insert: {
          contacts?: Json
          created_at?: string
          created_by: string
          decision_rule?: string
          description?: string | null
          field?: string
          followers_count?: number
          founded_at?: string
          goals?: string | null
          id?: string
          is_open?: boolean
          language?: string
          links?: Json
          logo_url?: string | null
          name: string
          reputation?: number
          revenue_model?: string
          slug: string
          updated_at?: string
        }
        Update: {
          contacts?: Json
          created_at?: string
          created_by?: string
          decision_rule?: string
          description?: string | null
          field?: string
          followers_count?: number
          founded_at?: string
          goals?: string | null
          id?: string
          is_open?: boolean
          language?: string
          links?: Json
          logo_url?: string | null
          name?: string
          reputation?: number
          revenue_model?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          likes: number
          topic: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          likes?: number
          topic?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          likes?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_theme: string
          app_background_url: string | null
          audio_url: string | null
          avatar_url: string | null
          bio: string | null
          card_skin: string
          created_at: string
          display_name: string
          featured_emoji: string | null
          id: string
          is_author: boolean
          is_blocked: boolean
          is_verified: boolean
          owned_accents: string[]
          owned_emojis: string[]
          owned_skins: string[]
          premium_until: string | null
          sandbox_html: string | null
          social_links: Json
          username: string
          verification_note: string | null
          verification_requested: boolean
        }
        Insert: {
          accent_theme?: string
          app_background_url?: string | null
          audio_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          card_skin?: string
          created_at?: string
          display_name: string
          featured_emoji?: string | null
          id: string
          is_author?: boolean
          is_blocked?: boolean
          is_verified?: boolean
          owned_accents?: string[]
          owned_emojis?: string[]
          owned_skins?: string[]
          premium_until?: string | null
          sandbox_html?: string | null
          social_links?: Json
          username: string
          verification_note?: string | null
          verification_requested?: boolean
        }
        Update: {
          accent_theme?: string
          app_background_url?: string | null
          audio_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          card_skin?: string
          created_at?: string
          display_name?: string
          featured_emoji?: string | null
          id?: string
          is_author?: boolean
          is_blocked?: boolean
          is_verified?: boolean
          owned_accents?: string[]
          owned_emojis?: string[]
          owned_skins?: string[]
          premium_until?: string | null
          sandbox_html?: string | null
          social_links?: Json
          username?: string
          verification_note?: string | null
          verification_requested?: boolean
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          chosen_index: number
          correct: boolean
          created_at: string
          id: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          chosen_index: number
          correct: boolean
          created_at?: string
          id?: string
          quiz_id: string
          user_id: string
        }
        Update: {
          chosen_index?: number
          correct?: boolean
          created_at?: string
          id?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          active_date: string
          correct_index: number
          created_at: string
          id: string
          options: Json
          question: string
          reward: number
        }
        Insert: {
          active_date?: string
          correct_index: number
          created_at?: string
          id?: string
          options: Json
          question: string
          reward?: number
        }
        Update: {
          active_date?: string
          correct_index?: number
          created_at?: string
          id?: string
          options?: Json
          question?: string
          reward?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          counterparty: string | null
          created_at: string
          fflow_active_delta: number
          fflow_pending_delta: number
          id: string
          note: string | null
          rflow_delta: number
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          counterparty?: string | null
          created_at?: string
          fflow_active_delta?: number
          fflow_pending_delta?: number
          id?: string
          note?: string | null
          rflow_delta?: number
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          counterparty?: string | null
          created_at?: string
          fflow_active_delta?: number
          fflow_pending_delta?: number
          id?: string
          note?: string | null
          rflow_delta?: number
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          fflow_active: number
          fflow_pending: number
          rflow_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          fflow_active?: number
          fflow_pending?: number
          rflow_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          fflow_active?: number
          fflow_pending?: number
          rflow_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_add_emoji_to_pack: {
        Args: { p_image_url: string; p_pack_id: string; p_shortcode: string }
        Returns: Json
      }
      app_admin_broadcast: {
        Args: { p_body: string; p_kind?: string; p_title: string }
        Returns: Json
      }
      app_admin_burn_fflow_global: { Args: { amount: number }; Returns: Json }
      app_admin_list_users: {
        Args: { only_pending?: boolean; search?: string }
        Returns: {
          display_name: string
          fflow_active: number
          fflow_pending: number
          id: string
          is_author: boolean
          is_blocked: boolean
          is_verified: boolean
          rflow_balance: number
          username: string
          verification_note: string
          verification_requested: boolean
        }[]
      }
      app_admin_mint_fflow: {
        Args: { amount: number; kind?: string; target_username: string }
        Returns: Json
      }
      app_admin_moderate_mini_app: {
        Args: { p_action: string; p_id: string; p_reason?: string }
        Returns: Json
      }
      app_admin_set_flag: {
        Args: { flag: string; target_username: string; value: boolean }
        Returns: Json
      }
      app_admin_stats: { Args: never; Returns: Json }
      app_create_custom_emoji: {
        Args: { p_image_url: string; p_shortcode: string }
        Returns: Json
      }
      app_create_emoji_pack: {
        Args: { p_cover_url?: string; p_name: string }
        Returns: Json
      }
      app_create_partnership: {
        Args: {
          p_decision_rule: string
          p_description: string
          p_field: string
          p_full_name: string
          p_goals: string
          p_is_open: boolean
          p_language: string
          p_logo_url: string
          p_name: string
          p_revenue_model: string
          p_signature: string
        }
        Returns: Json
      }
      app_delete_custom_emoji: { Args: { p_id: string }; Returns: Json }
      app_delete_emoji_pack: { Args: { p_id: string }; Returns: Json }
      app_ecosystem_charge: {
        Args: { p_amount: number; p_app_id: string; p_memo?: string }
        Returns: Json
      }
      app_ecosystem_get_context: { Args: { p_app_id: string }; Returns: Json }
      app_ecosystem_grant: { Args: { p_app_id: string }; Returns: Json }
      app_ecosystem_revoke: { Args: { p_app_id: string }; Returns: Json }
      app_fragment: {
        Args: { p_cost: number; p_label: string; p_pending: number }
        Returns: Json
      }
      app_join_partnership: {
        Args: { p_id: string; p_message?: string }
        Returns: Json
      }
      app_list_chats: {
        Args: never
        Returns: {
          chat_id: string
          last_body: string
          last_message_at: string
          other_avatar_url: string
          other_display_name: string
          other_id: string
          other_is_author: boolean
          other_is_verified: boolean
          other_username: string
        }[]
      }
      app_list_mini_apps: {
        Args: { p_category?: string; p_only_mine?: boolean; p_search?: string }
        Returns: {
          app_url: string
          category: string
          description: string
          icon_url: string
          id: string
          installs: number
          name: string
          owner_id: string
          owner_username: string
          slug: string
          status: string
          tagline: string
        }[]
      }
      app_list_partnerships: {
        Args: { p_only_mine?: boolean; p_search?: string }
        Returns: {
          description: string
          field: string
          followers_count: number
          founded_at: string
          id: string
          is_open: boolean
          logo_url: string
          members_count: number
          my_role: string
          name: string
          reputation: number
          slug: string
        }[]
      }
      app_mark_notifications_read: { Args: never; Returns: Json }
      app_open_chat: { Args: { other_username: string }; Returns: Json }
      app_p2p_transfer: {
        Args: { amount: number; memo?: string; recipient_username: string }
        Returns: Json
      }
      app_purchase_customization: {
        Args: { cost: number; item_id: string; item_type: string }
        Returns: Json
      }
      app_purchase_emoji: {
        Args: { cost: number; currency?: string; emoji_id: string }
        Returns: Json
      }
      app_qr_pay: {
        Args: { p_amount: number; p_merchant: string }
        Returns: Json
      }
      app_quiz_answer: {
        Args: { p_chosen_index: number; p_quiz_id: string }
        Returns: Json
      }
      app_request_verification: { Args: { note?: string }; Returns: Json }
      app_review_join_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: Json
      }
      app_send_message: {
        Args: { body: string; chat_id: string }
        Returns: Json
      }
      app_set_app_background: { Args: { p_url: string }; Returns: Json }
      app_set_chat_background: {
        Args: { p_chat_id: string; p_url: string }
        Returns: Json
      }
      app_set_featured_emoji: { Args: { p_value: string }; Returns: Json }
      app_submit_mini_app: {
        Args: {
          p_app_url: string
          p_category: string
          p_description: string
          p_icon_url: string
          p_name: string
          p_slug: string
          p_tagline: string
        }
        Returns: Json
      }
      app_subscribe_premium: {
        Args: { currency: string; months: number }
        Returns: Json
      }
      app_toggle_follow_partnership: { Args: { p_id: string }; Returns: Json }
      app_topup_rflow: {
        Args: { p_amount: number; p_card_last4: string }
        Returns: Json
      }
      app_unread_notifications_count: { Args: never; Returns: number }
      app_update_profile_extras: {
        Args: {
          p_audio_url?: string
          p_bio?: string
          p_sandbox_html?: string
          p_social_links?: Json
        }
        Returns: Json
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_partner_admin: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
      is_partner_member: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
    }
    Enums: {
      tx_type:
        | "payment"
        | "transfer"
        | "fragmentation"
        | "donation"
        | "quiz_reward"
        | "spend_reward"
        | "liquidity_lock"
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
      tx_type: [
        "payment",
        "transfer",
        "fragmentation",
        "donation",
        "quiz_reward",
        "spend_reward",
        "liquidity_lock",
      ],
    },
  },
} as const
