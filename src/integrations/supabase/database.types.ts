/* eslint-disable @typescript-eslint/no-empty-object-type */
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
      games: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          camera_type: string | null
          created_at: string | null
          date: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          last_error: string | null
          processing_metadata: Json | null
          progress_percentage: number | null
          status: string | null
          updated_at: string | null
          venue: string | null
          video_path: string | null
          youtube_url: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          camera_type?: string | null
          created_at?: string | null
          date?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          last_error?: string | null
          processing_metadata?: Json | null
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          venue?: string | null
          video_path?: string | null
          youtube_url?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          camera_type?: string | null
          created_at?: string | null
          date?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          last_error?: string | null
          processing_metadata?: Json | null
          progress_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          venue?: string | null
          video_path?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_stats: {
        Row: {
          assists: number | null
          created_at: string | null
          fg_attempted: number | null
          fg_made: number | null
          game_id: string | null
          id: string
          minutes_played: number | null
          player_ids: string[]
          points_against: number | null
          points_for: number | null
          possessions: number | null
          rebounds: number | null
          team_id: string | null
          three_pa: number | null
          three_pm: number | null
          turnovers: number | null
        }
        Insert: {
          assists?: number | null
          created_at?: string | null
          fg_attempted?: number | null
          fg_made?: number | null
          game_id?: string | null
          id?: string
          minutes_played?: number | null
          player_ids: string[]
          points_against?: number | null
          points_for?: number | null
          possessions?: number | null
          rebounds?: number | null
          team_id?: string | null
          three_pa?: number | null
          three_pm?: number | null
          turnovers?: number | null
        }
        Update: {
          assists?: number | null
          created_at?: string | null
          fg_attempted?: number | null
          fg_made?: number | null
          game_id?: string | null
          id?: string
          minutes_played?: number | null
          player_ids?: string[]
          points_against?: number | null
          points_for?: number | null
          possessions?: number | null
          rebounds?: number | null
          team_id?: string | null
          three_pa?: number | null
          three_pm?: number | null
          turnovers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      play_by_play: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          game_id: string | null
          game_time: string | null
          id: string
          is_make: boolean | null
          player_id: string | null
          team_id: string | null
          timestamp_seconds: number | null
          video_url: string | null
          x_coord: number | null
          y_coord: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          game_id?: string | null
          game_time?: string | null
          id?: string
          is_make?: boolean | null
          player_id?: string | null
          team_id?: string | null
          timestamp_seconds?: number | null
          video_url?: string | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          game_id?: string | null
          game_time?: string | null
          id?: string
          is_make?: boolean | null
          player_id?: string | null
          team_id?: string | null
          timestamp_seconds?: number | null
          video_url?: string | null
          x_coord?: number | null
          y_coord?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "play_by_play_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_by_play_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_by_play_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_stats: {
        Row: {
          assists: number | null
          blocks: number | null
          fg_attempted: number | null
          fg_made: number | null
          ft_attempted: number | null
          ft_made: number | null
          game_id: string | null
          id: string
          minutes: number | null
          player_id: string | null
          plus_minus: number | null
          points: number | null
          rebounds: number | null
          steals: number | null
          three_attempted: number | null
          three_made: number | null
          turnovers: number | null
        }
        Insert: {
          assists?: number | null
          blocks?: number | null
          fg_attempted?: number | null
          fg_made?: number | null
          ft_attempted?: number | null
          ft_made?: number | null
          game_id?: string | null
          id?: string
          minutes?: number | null
          player_id?: string | null
          plus_minus?: number | null
          points?: number | null
          rebounds?: number | null
          steals?: number | null
          three_attempted?: number | null
          three_made?: number | null
          turnovers?: number | null
        }
        Update: {
          assists?: number | null
          blocks?: number | null
          fg_attempted?: number | null
          fg_made?: number | null
          ft_attempted?: number | null
          ft_made?: number | null
          game_id?: string | null
          id?: string
          minutes?: number | null
          player_id?: string | null
          plus_minus?: number | null
          points?: number | null
          rebounds?: number | null
          steals?: number | null
          three_attempted?: number | null
          three_made?: number | null
          turnovers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_game_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string
          number: number | null
          position: string | null
          team_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          number?: number | null
          position?: string | null
          team_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          number?: number | null
          position?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
