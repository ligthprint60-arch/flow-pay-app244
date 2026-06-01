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
          owned_skins: string[]
          username: string
          verification_note: string | null
          verification_requested: boolean
        }
        Insert: {
          accent_theme?: string
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
          owned_skins?: string[]
          username: string
          verification_note?: string | null
          verification_requested?: boolean
        }
        Update: {
          accent_theme?: string
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
          owned_skins?: string[]
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
      app_admin_set_flag: {
        Args: { flag: string; target_username: string; value: boolean }
        Returns: Json
      }
      app_admin_stats: { Args: never; Returns: Json }
      app_p2p_transfer: {
        Args: { amount: number; memo?: string; recipient_username: string }
        Returns: Json
      }
      app_purchase_customization: {
        Args: { cost: number; item_id: string; item_type: string }
        Returns: Json
      }
      app_request_verification: { Args: { note?: string }; Returns: Json }
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
