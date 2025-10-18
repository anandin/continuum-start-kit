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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      engagements: {
        Row: {
          created_at: string | null
          id: string
          provider_id: string | null
          seeker_id: string | null
          status: Database["public"]["Enums"]["engagement_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider_id?: string | null
          seeker_id?: string | null
          status?: Database["public"]["Enums"]["engagement_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          provider_id?: string | null
          seeker_id?: string | null
          status?: Database["public"]["Enums"]["engagement_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "seekers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["msg_role"]
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["msg_role"]
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["msg_role"]
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      progress_indicators: {
        Row: {
          created_at: string | null
          detail: Json | null
          engagement_id: string | null
          id: string
          session_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          engagement_id?: string | null
          id?: string
          session_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          engagement_id?: string | null
          id?: string
          session_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_indicators_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_indicators_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_agent_configs: {
        Row: {
          avatar_url: string | null
          boundaries: string | null
          core_identity: string | null
          created_at: string | null
          guiding_principles: string | null
          id: string
          provider_id: string
          provider_name: string | null
          provider_title: string | null
          rules: string | null
          selected_model: string | null
          tone: string | null
          updated_at: string | null
          voice: string | null
        }
        Insert: {
          avatar_url?: string | null
          boundaries?: string | null
          core_identity?: string | null
          created_at?: string | null
          guiding_principles?: string | null
          id?: string
          provider_id: string
          provider_name?: string | null
          provider_title?: string | null
          rules?: string | null
          selected_model?: string | null
          tone?: string | null
          updated_at?: string | null
          voice?: string | null
        }
        Update: {
          avatar_url?: string | null
          boundaries?: string | null
          core_identity?: string | null
          created_at?: string | null
          guiding_principles?: string | null
          id?: string
          provider_id?: string
          provider_name?: string | null
          provider_title?: string | null
          rules?: string | null
          selected_model?: string | null
          tone?: string | null
          updated_at?: string | null
          voice?: string | null
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          created_at: string | null
          id: string
          labels: Json | null
          methodology: string | null
          provider_id: string | null
          stages: Json
          summary_template: Json | null
          tagging_rules: Json | null
          title: string
          trajectory_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          labels?: Json | null
          methodology?: string | null
          provider_id?: string | null
          stages: Json
          summary_template?: Json | null
          tagging_rules?: Json | null
          title: string
          trajectory_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          labels?: Json | null
          methodology?: string | null
          provider_id?: string | null
          stages?: Json
          summary_template?: Json | null
          tagging_rules?: Json | null
          title?: string
          trajectory_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_configs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seekers: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seekers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          ended_at: string | null
          engagement_id: string | null
          id: string
          initial_stage: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"] | null
        }
        Insert: {
          ended_at?: string | null
          engagement_id?: string | null
          id?: string
          initial_stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
        }
        Update: {
          ended_at?: string | null
          engagement_id?: string | null
          id?: string
          initial_stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          assigned_stage: string | null
          created_at: string | null
          id: string
          key_insights: Json | null
          next_action: string | null
          session_id: string | null
          session_summary: string | null
          trajectory_status: string | null
        }
        Insert: {
          assigned_stage?: string | null
          created_at?: string | null
          id?: string
          key_insights?: Json | null
          next_action?: string | null
          session_id?: string | null
          session_summary?: string | null
          trajectory_status?: string | null
        }
        Update: {
          assigned_stage?: string | null
          created_at?: string | null
          id?: string
          key_insights?: Json | null
          next_action?: string | null
          session_id?: string | null
          session_summary?: string | null
          trajectory_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "provider" | "seeker"
      engagement_status: "active" | "paused" | "completed"
      msg_role: "seeker" | "agent" | "provider"
      session_status: "active" | "ended"
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
      app_role: ["provider", "seeker"],
      engagement_status: ["active", "paused", "completed"],
      msg_role: ["seeker", "agent", "provider"],
      session_status: ["active", "ended"],
    },
  },
} as const
