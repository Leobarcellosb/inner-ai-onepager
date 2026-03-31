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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      briefs: {
        Row: {
          brief_title: string
          campaign_objective: string
          content_id: string
          copy_summary: string
          created_at: string
          creative_angle: string
          cta: string
          designer_notes: string
          id: string
          key_message: string
          mandatory_elements: string
          status: Database["public"]["Enums"]["brief_status"]
          suggested_slides_or_scenes: string
          target_audience: string
          updated_at: string
          visual_direction: string
          visual_references: string
        }
        Insert: {
          brief_title: string
          campaign_objective?: string
          content_id: string
          copy_summary?: string
          created_at?: string
          creative_angle?: string
          cta?: string
          designer_notes?: string
          id?: string
          key_message?: string
          mandatory_elements?: string
          status?: Database["public"]["Enums"]["brief_status"]
          suggested_slides_or_scenes?: string
          target_audience?: string
          updated_at?: string
          visual_direction?: string
          visual_references?: string
        }
        Update: {
          brief_title?: string
          campaign_objective?: string
          content_id?: string
          copy_summary?: string
          created_at?: string
          creative_angle?: string
          cta?: string
          designer_notes?: string
          id?: string
          key_message?: string
          mandatory_elements?: string
          status?: Database["public"]["Enums"]["brief_status"]
          suggested_slides_or_scenes?: string
          target_audience?: string
          updated_at?: string
          visual_direction?: string
          visual_references?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          cta: string
          format: Database["public"]["Enums"]["content_format"]
          funnel_stage: string
          id: string
          improved_text: string | null
          objective: string
          platform: Database["public"]["Enums"]["content_platform"]
          raw_text: string
          status: Database["public"]["Enums"]["content_status"]
          target_audience: string
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          cta?: string
          format?: Database["public"]["Enums"]["content_format"]
          funnel_stage?: string
          id?: string
          improved_text?: string | null
          objective?: string
          platform?: Database["public"]["Enums"]["content_platform"]
          raw_text?: string
          status?: Database["public"]["Enums"]["content_status"]
          target_audience?: string
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          cta?: string
          format?: Database["public"]["Enums"]["content_format"]
          funnel_stage?: string
          id?: string
          improved_text?: string | null
          objective?: string
          platform?: Database["public"]["Enums"]["content_platform"]
          raw_text?: string
          status?: Database["public"]["Enums"]["content_status"]
          target_audience?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id: string
          name?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "social_media" | "designer"
      brief_status: "novo" | "em_andamento" | "em_ajuste" | "finalizado"
      content_format:
        | "reels"
        | "carrossel"
        | "story"
        | "post_estatico"
        | "anuncio"
        | "email"
        | "roteiro"
      content_platform:
        | "instagram"
        | "tiktok"
        | "youtube"
        | "linkedin"
        | "whatsapp"
        | "multiuso"
      content_status:
        | "ideia"
        | "rascunho"
        | "em_revisao"
        | "aguardando_design"
        | "em_design"
        | "pronto"
        | "publicado"
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
      app_role: ["admin", "social_media", "designer"],
      brief_status: ["novo", "em_andamento", "em_ajuste", "finalizado"],
      content_format: [
        "reels",
        "carrossel",
        "story",
        "post_estatico",
        "anuncio",
        "email",
        "roteiro",
      ],
      content_platform: [
        "instagram",
        "tiktok",
        "youtube",
        "linkedin",
        "whatsapp",
        "multiuso",
      ],
      content_status: [
        "ideia",
        "rascunho",
        "em_revisao",
        "aguardando_design",
        "em_design",
        "pronto",
        "publicado",
      ],
    },
  },
} as const
