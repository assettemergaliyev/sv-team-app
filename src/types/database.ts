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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      athlete_accounts: {
        Row: {
          athlete_id: string
          club_id: string
          user_id: string
        }
        Insert: {
          athlete_id: string
          club_id: string
          user_id: string
        }
        Update: {
          athlete_id?: string
          club_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_accounts_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "athlete_accounts_club_id_user_id_fkey"
            columns: ["club_id", "user_id"]
            isOneToOne: true
            referencedRelation: "club_users"
            referencedColumns: ["club_id", "user_id"]
          },
        ]
      }
      athlete_group_memberships: {
        Row: {
          athlete_id: string
          club_id: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          revision: number
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          athlete_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          athlete_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_group_memberships_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "athlete_group_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_group_memberships_club_id_group_id_fkey"
            columns: ["club_id", "group_id"]
            isOneToOne: false
            referencedRelation: "sport_groups"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      athlete_private: {
        Row: {
          athlete_id: string
          birth_date: string | null
          club_id: string
        }
        Insert: {
          athlete_id: string
          birth_date?: string | null
          club_id: string
        }
        Update: {
          athlete_id?: string
          birth_date?: string | null
          club_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_private_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      athletes: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          last_name: string
          revision: number
          sex: string | null
          sport_status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          first_name: string
          id?: string
          last_name: string
          revision?: number
          sex?: string | null
          sport_status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          last_name?: string
          revision?: number
          sex?: string | null
          sport_status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_attendance: {
        Row: {
          athlete_id: string
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          is_counted: boolean
          is_selected: boolean
          revision: number
          updated_at: string
          updated_by: string | null
          visited_on: string
        }
        Insert: {
          athlete_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_counted?: boolean
          is_selected?: boolean
          revision?: number
          updated_at?: string
          updated_by?: string | null
          visited_on: string
        }
        Update: {
          athlete_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_counted?: boolean
          is_selected?: boolean
          revision?: number
          updated_at?: string
          updated_by?: string | null
          visited_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_attendance_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "pool_attendance_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_attendance_roster: {
        Row: {
          athlete_id: string
          club_id: string
          created_at: string
          created_by: string | null
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          athlete_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          athlete_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_attendance_roster_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "pool_attendance_roster_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_segments: {
        Row: {
          attempt_id: string
          club_id: string
          segment_code: string
          time_cs: number
        }
        Insert: {
          attempt_id: string
          club_id: string
          segment_code: string
          time_cs: number
        }
        Update: {
          attempt_id?: string
          club_id?: string
          segment_code?: string
          time_cs?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempt_segments_club_id_attempt_id_fkey"
            columns: ["club_id", "attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      attempt_staff_notes: {
        Row: {
          attempt_id: string
          author_id: string
          club_id: string
          note: string
          revision: number
          updated_at: string
        }
        Insert: {
          attempt_id: string
          author_id: string
          club_id: string
          note: string
          revision?: number
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          author_id?: string
          club_id?: string
          note?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_staff_notes_club_id_attempt_id_fkey"
            columns: ["club_id", "attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      attempts: {
        Row: {
          attempt_no: number
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          occurred_at: string | null
          revision: number
          session_participant_id: string
          status: string
          time_cs: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attempt_no: number
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          occurred_at?: string | null
          revision?: number
          session_participant_id: string
          status?: string
          time_cs?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attempt_no?: number
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          occurred_at?: string | null
          revision?: number
          session_participant_id?: string
          status?: string
          time_cs?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_club_id_session_participant_id_fkey"
            columns: ["club_id", "session_participant_id"]
            isOneToOne: false
            referencedRelation: "session_participants"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          after_payload: Json | null
          before_payload: Json | null
          club_id: string
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
          reason: string | null
          request_fingerprint: string | null
          request_id: string | null
          revision_after: number | null
          revision_before: number | null
          visibility: string
        }
        Insert: {
          action: string
          actor_id: string
          after_payload?: Json | null
          before_payload?: Json | null
          club_id: string
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
          reason?: string | null
          request_fingerprint?: string | null
          request_id?: string | null
          revision_after?: number | null
          revision_before?: number | null
          visibility?: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_payload?: Json | null
          before_payload?: Json | null
          club_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          request_fingerprint?: string | null
          request_id?: string | null
          revision_after?: number | null
          revision_before?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_users: {
        Row: {
          access_status: string
          club_id: string
          created_at: string
          revision: number
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_status?: string
          club_id: string
          created_at?: string
          revision?: number
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_status?: string
          club_id?: string
          created_at?: string
          revision?: number
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_users_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          athlete_id: string
          club_id: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          athlete_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          athlete_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "event_participants_club_id_event_id_fkey"
            columns: ["club_id", "event_id"]
            isOneToOne: false
            referencedRelation: "test_events"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "event_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          athlete_id: string | null
          auth_invitation_reference: string | null
          club_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          intended_role: string
          revision: number
          revoked_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          athlete_id?: string | null
          auth_invitation_reference?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          intended_role: string
          revision?: number
          revoked_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          athlete_id?: string | null
          auth_invitation_reference?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          intended_role?: string
          revision?: number
          revoked_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_best_records: {
        Row: {
          athlete_id: string
          club_id: string
          definition_id: string
          imported_at: string
          recorded_on: string
          source_row: number
          source_sheet: string
          time_cs: number
        }
        Insert: {
          athlete_id: string
          club_id: string
          definition_id: string
          imported_at?: string
          recorded_on: string
          source_row: number
          source_sheet: string
          time_cs: number
        }
        Update: {
          athlete_id?: string
          club_id?: string
          definition_id?: string
          imported_at?: string
          recorded_on?: string
          source_row?: number
          source_sheet?: string
          time_cs?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_best_records_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "personal_best_records_club_id_definition_id_fkey"
            columns: ["club_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      session_participants: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          event_id: string
          event_participant_id: string
          id: string
          removed_at: string | null
          revision: number
          session_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          event_participant_id: string
          id?: string
          removed_at?: string | null
          revision?: number
          session_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          event_participant_id?: string
          id?: string
          removed_at?: string | null
          revision?: number
          session_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_club_id_event_id_event_participant_id_fkey"
            columns: ["club_id", "event_id", "event_participant_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["club_id", "event_id", "id"]
          },
          {
            foreignKeyName: "session_participants_club_id_event_id_session_id_fkey"
            columns: ["club_id", "event_id", "session_id"]
            isOneToOne: false
            referencedRelation: "test_sessions"
            referencedColumns: ["club_id", "event_id", "id"]
          },
          {
            foreignKeyName: "session_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_groups: {
        Row: {
          club_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_groups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_definitions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          discipline: string
          distance_m: number
          environment_code: string
          format_code: string
          id: string
          is_active: boolean
          revision: number
          stroke_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          discipline: string
          distance_m: number
          environment_code: string
          format_code: string
          id?: string
          is_active?: boolean
          revision?: number
          stroke_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          discipline?: string
          distance_m?: number
          environment_code?: string
          format_code?: string
          id?: string
          is_active?: boolean
          revision?: number
          stroke_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_definitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_events: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          club_id: string
          created_at: string
          created_by: string | null
          definition_id: string
          id: string
          lifecycle: string
          revision: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          definition_id: string
          id?: string
          lifecycle?: string
          revision?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          definition_id?: string
          id?: string
          lifecycle?: string
          revision?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_events_club_id_definition_id_fkey"
            columns: ["club_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "test_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sessions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string | null
          id: string
          label: string
          published_at: string | null
          published_by: string | null
          revision: number
          scheduled_at: string | null
          scheduled_on: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          event_id: string
          group_id?: string | null
          id?: string
          label: string
          published_at?: string | null
          published_by?: string | null
          revision?: number
          scheduled_at?: string | null
          scheduled_on: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          group_id?: string | null
          id?: string
          label?: string
          published_at?: string | null
          published_by?: string | null
          revision?: number
          scheduled_at?: string | null
          scheduled_on?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_sessions_club_id_event_id_fkey"
            columns: ["club_id", "event_id"]
            isOneToOne: false
            referencedRelation: "test_events"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "test_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_sessions_club_id_group_id_fkey"
            columns: ["club_id", "group_id"]
            isOneToOne: false
            referencedRelation: "sport_groups"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          language: string
          user_id: string
        }
        Insert: {
          language?: string
          user_id: string
        }
        Update: {
          language?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      event_leaderboard: {
        Row: {
          athlete_id: string | null
          best_time_cs: number | null
          club_id: string | null
          event_id: string | null
          place: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_club_id_athlete_id_fkey"
            columns: ["club_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "event_participants_club_id_event_id_fkey"
            columns: ["club_id", "event_id"]
            isOneToOne: false
            referencedRelation: "test_events"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "event_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_test_definition: {
        Args: {
          p_club: string
          p_definition: string
          p_reason: string
        }
        Returns: Json
      }
      sv_command: {
        Args: {
          p_action: string
          p_club: string
          p_payload: Json
          p_request: string
        }
        Returns: Json
      }
      pool_attendance_command: {
        Args: {
          p_action: string
          p_club: string
          p_payload: Json
          p_request: string
        }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

