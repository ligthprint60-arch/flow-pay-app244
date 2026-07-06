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
          shortcode: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          owner_id: string
          shortcode: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          owner_id?: string
          shortcode?: string
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
      app_delete_custom_emoji: { Args: { p_id: string }; Returns: Json }
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
      app_send_message: {
        Args: { body: string; chat_id: string }
        Returns: Json
      }
      app_set_app_background: { Args: { p_url: string }; Returns: Json }
      app_set_chat_background: {
        Args: { p_chat_id: string; p_url: string }
        Returns: Json
      }
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
