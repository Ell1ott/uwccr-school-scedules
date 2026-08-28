export type Database = {
  public: {
    Tables: {
      teachers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          auth_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cancellations: {
        Row: {
          id: string;
          teacher_id: string;
          on_date: string;
          block: string;
          subject: string | null;
          reason: string | null;
          start_time: string | null;
          student_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          on_date: string;
          block: string;
          subject?: string | null;
          reason?: string | null;
          start_time?: string | null;
          student_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          on_date?: string;
          block?: string;
          subject?: string | null;
          reason?: string | null;
          start_time?: string | null;
          student_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      lesson_notes: {
        Row: {
          id: string;
          teacher_id: string;
          on_date: string;
          block: string;
          body: string;
          subject: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          on_date: string;
          block: string;
          body: string;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          on_date?: string;
          block?: string;
          body?: string;
          subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          student_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_teacher_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
