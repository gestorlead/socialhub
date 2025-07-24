export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      integration_settings: {
        Row: {
          app_id: string | null
          callback_url: string | null
          client_key: string | null
          client_secret: string | null
          config_data: Json | null
          created_at: string | null
          created_by: string | null
          environment: string | null
          id: string
          is_active: boolean | null
          is_audited: boolean | null
          platform: string
          updated_at: string | null
          updated_by: string | null
          webhook_url: string | null
        }
        Insert: {
          app_id?: string | null
          callback_url?: string | null
          client_key?: string | null
          client_secret?: string | null
          config_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          is_audited?: boolean | null
          platform: string
          updated_at?: string | null
          updated_by?: string | null
          webhook_url?: string | null
        }
        Update: {
          app_id?: string | null
          callback_url?: string | null
          client_key?: string | null
          client_secret?: string | null
          config_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          is_audited?: boolean | null
          platform?: string
          updated_at?: string | null
          updated_by?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      integration_settings_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          integration_id: string | null
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          platform: string
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          platform: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          platform?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_audit_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          level: number
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          level: number
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          level?: number
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          platform: string
          platform_user_id: string
          profile_data: Json | null
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform: string
          platform_user_id: string
          profile_data?: Json | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform?: string
          platform_user_id?: string
          profile_data?: Json | null
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tiktok_daily_stats: {
        Row: {
          created_at: string | null
          date: string
          follower_count: number | null
          following_count: number | null
          id: string
          likes_count: number | null
          platform_user_id: string
          updated_at: string | null
          user_id: string
          video_count: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          follower_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          platform_user_id: string
          updated_at?: string | null
          user_id: string
          video_count?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          follower_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          platform_user_id?: string
          updated_at?: string | null
          user_id?: string
          video_count?: number | null
        }
        Relationships: []
      }
      tiktok_videos: {
        Row: {
          comment_count: number | null
          cover_image_url: string | null
          create_time: string | null
          created_at: string | null
          description: string | null
          duration: number | null
          embed_link: string | null
          favorite_count: number | null
          height: number | null
          id: string
          is_top_video: boolean | null
          like_count: number | null
          platform_user_id: string
          play_count: number | null
          privacy_type: string | null
          share_count: number | null
          share_url: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          video_id: string
          video_url: string | null
          view_count: number | null
          width: number | null
        }
        Insert: {
          comment_count?: number | null
          cover_image_url?: string | null
          create_time?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          embed_link?: string | null
          favorite_count?: number | null
          height?: number | null
          id?: string
          is_top_video?: boolean | null
          like_count?: number | null
          platform_user_id: string
          play_count?: number | null
          privacy_type?: string | null
          share_count?: number | null
          share_url?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id: string
          video_url?: string | null
          view_count?: number | null
          width?: number | null
        }
        Update: {
          comment_count?: number | null
          cover_image_url?: string | null
          create_time?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          embed_link?: string | null
          favorite_count?: number | null
          height?: number | null
          id?: string
          is_top_video?: boolean | null
          like_count?: number | null
          platform_user_id?: string
          play_count?: number | null
          privacy_type?: string | null
          share_count?: number | null
          share_url?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string
          video_url?: string | null
          view_count?: number | null
          width?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_oauth_states: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const