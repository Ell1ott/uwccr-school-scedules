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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      cancellations: {
        Row: {
          block: string
          created_at: string
          id: string
          on_date: string
          reason: string | null
          start_time: string | null
          student_ids: string[]
          subject: string | null
          teacher_id: string
        }
        Insert: {
          block: string
          created_at?: string
          id?: string
          on_date: string
          reason?: string | null
          start_time?: string | null
          student_ids?: string[]
          subject?: string | null
          teacher_id: string
        }
        Update: {
          block?: string
          created_at?: string
          id?: string
          on_date?: string
          reason?: string | null
          start_time?: string | null
          student_ids?: string[]
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      cas: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          location: string
          moderation_token: string | null
          status: Database["public"]["Enums"]["cas_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          location?: string
          moderation_token?: string | null
          status?: Database["public"]["Enums"]["cas_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          location?: string
          moderation_token?: string | null
          status?: Database["public"]["Enums"]["cas_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_leaders: {
        Row: {
          cas_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          cas_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          cas_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cas_leaders_cas_id_fkey"
            columns: ["cas_id"]
            isOneToOne: false
            referencedRelation: "cas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cas_leaders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_members: {
        Row: {
          cas_id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          cas_id: string
          joined_at?: string
          student_id: string
        }
        Update: {
          cas_id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cas_members_cas_id_fkey"
            columns: ["cas_id"]
            isOneToOne: false
            referencedRelation: "cas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cas_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_session_series: {
        Row: {
          cas_id: string
          created_at: string
          created_by: string
          id: string
          until_date: string
        }
        Insert: {
          cas_id: string
          created_at?: string
          created_by: string
          id?: string
          until_date: string
        }
        Update: {
          cas_id?: string
          created_at?: string
          created_by?: string
          id?: string
          until_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cas_session_series_cas_id_fkey"
            columns: ["cas_id"]
            isOneToOne: false
            referencedRelation: "cas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cas_session_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_session_signups: {
        Row: {
          created_at: string
          id: string
          session_id: string
          status: Database["public"]["Enums"]["cas_signup_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          status: Database["public"]["Enums"]["cas_signup_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["cas_signup_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cas_session_signups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cas_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cas_session_signups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cas_sessions: {
        Row: {
          capacity: number | null
          cas_id: string
          created_at: string
          description: string
          ends_at: string
          going_count: number
          id: string
          label: string
          location: string
          mode: Database["public"]["Enums"]["cas_session_mode"]
          series_id: string | null
          split_group_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["cas_session_status"]
          updated_at: string
          waitlisted_count: number
        }
        Insert: {
          capacity?: number | null
          cas_id: string
          created_at?: string
          description?: string
          ends_at: string
          going_count?: number
          id?: string
          label?: string
          location?: string
          mode?: Database["public"]["Enums"]["cas_session_mode"]
          series_id?: string | null
          split_group_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["cas_session_status"]
          updated_at?: string
          waitlisted_count?: number
        }
        Update: {
          capacity?: number | null
          cas_id?: string
          created_at?: string
          description?: string
          ends_at?: string
          going_count?: number
          id?: string
          label?: string
          location?: string
          mode?: Database["public"]["Enums"]["cas_session_mode"]
          series_id?: string | null
          split_group_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["cas_session_status"]
          updated_at?: string
          waitlisted_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "cas_sessions_cas_id_fkey"
            columns: ["cas_id"]
            isOneToOne: false
            referencedRelation: "cas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cas_sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "cas_session_series"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_log: {
        Row: {
          created_at: string
          decision: string
          event_ids: string[]
          from_address: string
          id: string
          message_id: string | null
          reason: string
          resend_email_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          event_ids?: string[]
          from_address?: string
          id?: string
          message_id?: string | null
          reason?: string
          resend_email_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          event_ids?: string[]
          from_address?: string
          id?: string
          message_id?: string | null
          reason?: string
          resend_email_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_audience: {
        Row: {
          event_id: string
          student_id: string
        }
        Insert: {
          event_id: string
          student_id: string
        }
        Update: {
          event_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_audience_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_responses: {
        Row: {
          created_at: string
          event_id: string
          id: string
          responded_at: string | null
          source: Database["public"]["Enums"]["rsvp_source"]
          status: Database["public"]["Enums"]["rsvp_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          responded_at?: string | null
          source: Database["public"]["Enums"]["rsvp_source"]
          status: Database["public"]["Enums"]["rsvp_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          source?: Database["public"]["Enums"]["rsvp_source"]
          status?: Database["public"]["Enums"]["rsvp_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          created_by: string
          freq: string
          id: string
          until_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          freq: string
          id?: string
          until_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          freq?: string
          id?: string
          until_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_targets: {
        Row: {
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["target_kind"]
          payload: Json
        }
        Insert: {
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["target_kind"]
          payload?: Json
        }
        Update: {
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["target_kind"]
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_targets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          capacity: number | null
          created_at: string
          created_by: string
          description: string
          ends_at: string
          going_count: number
          id: string
          location: string
          mode: Database["public"]["Enums"]["event_mode"]
          moderation_token: string | null
          series_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          waitlisted_count: number
        }
        Insert: {
          all_day?: boolean
          capacity?: number | null
          created_at?: string
          created_by: string
          description?: string
          ends_at: string
          going_count?: number
          id?: string
          location?: string
          mode: Database["public"]["Enums"]["event_mode"]
          moderation_token?: string | null
          series_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          waitlisted_count?: number
        }
        Update: {
          all_day?: boolean
          capacity?: number | null
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          going_count?: number
          id?: string
          location?: string
          mode?: Database["public"]["Enums"]["event_mode"]
          moderation_token?: string | null
          series_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          waitlisted_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          block: string
          body: string
          created_at: string
          id: string
          on_date: string
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          block: string
          body: string
          created_at?: string
          id?: string
          on_date: string
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          block?: string
          body?: string
          created_at?: string
          id?: string
          on_date?: string
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name: string
          email: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          student_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          student_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          student_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          auth_user_id: string | null
          cohort: string
          created_at: string
          email: string | null
          house_id: string | null
          id: string
          name: string
        }
        Insert: {
          auth_user_id?: string | null
          cohort: string
          created_at?: string
          email?: string | null
          house_id?: string | null
          id: string
          name: string
        }
        Update: {
          auth_user_id?: string | null
          cohort?: string
          created_at?: string
          email?: string | null
          house_id?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          name: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_cas_leader: {
        Args: { p_cas_id: string; p_student_id?: string; p_teacher_id?: string }
        Returns: undefined
      }
      archive_cas: { Args: { p_cas_id: string }; Returns: undefined }
      can_see_cas: { Args: { p_cas_id: string }; Returns: boolean }
      cancel_cas_session: {
        Args: { p_rest_of_series?: boolean; p_session_id: string }
        Returns: number
      }
      cancel_cas_signup: { Args: { p_session_id: string }; Returns: undefined }
      cancel_event: {
        Args: { p_event_id: string; p_rest_of_series?: boolean }
        Returns: number
      }
      create_cas: {
        Args: {
          p_description: string
          p_leader_student_ids?: string[]
          p_location: string
          p_title: string
        }
        Returns: Json
      }
      create_cas_sessions: {
        Args: {
          p_capacity: number | null
          p_cas_id: string
          p_description: string
          p_ends: string[]
          p_freq?: string
          p_label: string
          p_location: string
          p_mode: Database["public"]["Enums"]["cas_session_mode"]
          p_starts: string[]
          p_until_date?: string
        }
        Returns: string[]
      }
      create_event_batch: {
        Args: {
          p_all_day: boolean
          p_audience: string[]
          p_capacity: number | null
          p_description: string
          p_ends: string[]
          p_freq?: string
          p_location: string
          p_mode: Database["public"]["Enums"]["event_mode"]
          p_starts: string[]
          p_targets: Json
          p_title: string
          p_until_date?: string
        }
        Returns: Json
      }
      create_pending_event_batch: {
        Args: {
          p_all_day: boolean
          p_audience: string[]
          p_capacity: number | null
          p_created_by: string
          p_description: string
          p_ends: string[]
          p_freq?: string
          p_location: string
          p_mode: Database["public"]["Enums"]["event_mode"]
          p_starts: string[]
          p_targets: Json
          p_title: string
          p_until_date?: string
        }
        Returns: Json
      }
      current_profile_id: { Args: never; Returns: string }
      current_student_id: { Args: never; Returns: string }
      current_teacher_id: { Args: never; Returns: string }
      is_cas_leader: { Args: { p_cas_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      join_cas: { Args: { p_cas_id: string }; Returns: undefined }
      join_event: {
        Args: { p_event_id: string }
        Returns: Database["public"]["Enums"]["rsvp_status"]
      }
      leave_cas: { Args: { p_cas_id: string }; Returns: undefined }
      leave_event: { Args: { p_event_id: string }; Returns: undefined }
      moderate_cas_by_token: {
        Args: { p_decision: string; p_token: string }
        Returns: Json
      }
      moderate_events_by_token: {
        Args: { p_decision: string; p_token: string }
        Returns: Json
      }
      pending_cas_for_token: { Args: { p_token: string }; Returns: Json }
      pending_events_for_token: { Args: { p_token: string }; Returns: Json }
      remove_cas_leader: {
        Args: { p_cas_id: string; p_profile_id: string }
        Returns: undefined
      }
      signup_cas_session: {
        Args: { p_session_id: string }
        Returns: Database["public"]["Enums"]["cas_signup_status"]
      }
      split_cas_session: {
        Args: {
          p_capacity?: number | null
          p_ends: string[]
          p_labels?: string[]
          p_session_id: string
          p_starts: string[]
        }
        Returns: string[]
      }
      student_is_cas_member: { Args: { p_cas_id: string }; Returns: boolean }
      update_cas: {
        Args: {
          p_cas_id: string
          p_description: string
          p_location: string
          p_title: string
        }
        Returns: undefined
      }
      update_cas_session: {
        Args: {
          p_capacity: number | null
          p_description: string
          p_ends_at: string
          p_label: string
          p_location: string
          p_mode: Database["public"]["Enums"]["cas_session_mode"]
          p_rest_of_series?: boolean
          p_session_id: string
          p_starts_at: string
        }
        Returns: number
      }
      promote_waitlist: { Args: { p_event_id: string }; Returns: undefined }
      seed_event_responses: { Args: { p_event_id: string }; Returns: undefined }
      respond_invite: {
        Args: {
          p_event_id: string
          p_status: Database["public"]["Enums"]["rsvp_status"]
        }
        Returns: Database["public"]["Enums"]["rsvp_status"]
      }
      student_can_see_event: { Args: { p_event_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "student" | "staff"
      cas_session_mode: "mandatory" | "signup" | "optional"
      cas_session_status: "published" | "cancelled"
      cas_signup_status: "going" | "waitlisted"
      cas_status: "pending" | "published" | "archived" | "rejected"
      event_mode: "mandatory" | "invite" | "open" | "info"
      event_status: "published" | "cancelled" | "pending" | "rejected"
      rsvp_source: "assigned" | "joined"
      rsvp_status: "pending" | "going" | "declined" | "waitlisted"
      target_kind:
        | "all_students"
        | "cohort"
        | "academic_class"
        | "student"
        | "house"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["student", "staff"],
      cas_session_mode: ["mandatory", "signup", "optional"],
      cas_session_status: ["published", "cancelled"],
      cas_signup_status: ["going", "waitlisted"],
      cas_status: ["pending", "published", "archived", "rejected"],
      event_mode: ["mandatory", "invite", "open", "info"],
      event_status: ["published", "cancelled"],
      rsvp_source: ["assigned", "joined"],
      rsvp_status: ["pending", "going", "declined", "waitlisted"],
      target_kind: [
        "all_students",
        "cohort",
        "academic_class",
        "student",
        "house",
      ],
    },
  },
} as const
