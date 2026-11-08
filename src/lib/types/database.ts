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
      activities: {
        Row: {
          activity_type: string
          average_speed_kmh: number | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number
          estimated_kcal_burned: number | null
          id: string
          kcal_source: string | null
          local_date: string
          notes: string | null
          started_at: string | null
          steps: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          average_speed_kmh?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds: number
          estimated_kcal_burned?: number | null
          id?: string
          kcal_source?: string | null
          local_date: string
          notes?: string | null
          started_at?: string | null
          steps?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          average_speed_kmh?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number
          estimated_kcal_burned?: number | null
          id?: string
          kcal_source?: string | null
          local_date?: string
          notes?: string | null
          started_at?: string | null
          steps?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_daily_insights: {
        Row: {
          body: string
          created_at: string
          id: string
          local_date: string
          locale: string
          model: string | null
          provider: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          local_date: string
          locale: string
          model?: string | null
          provider?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          local_date?: string
          locale?: string
          model?: string | null
          provider?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          provider: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          provider?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          provider?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_user_id_fkey"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          feature: string
          id: number
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          provider: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          created_at: string
          id: string
          local_date: string
          measured_at: string
          notes: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          local_date: string
          measured_at?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          local_date?: string
          measured_at?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          equipment: string | null
          id: string
          muscle_group: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment?: string | null
          id?: string
          muscle_group?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment?: string | null
          id?: string
          muscle_group?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_items: {
        Row: {
          brand: string | null
          carbs_per_100g: number
          created_at: string
          fat_per_100g: number
          fibre_per_100g: number | null
          id: string
          kcal_per_100g: number
          last_used_at: string | null
          name: string
          protein_per_100g: number
          serving_description: string | null
          serving_grams: number | null
          source: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          carbs_per_100g: number
          created_at?: string
          fat_per_100g: number
          fibre_per_100g?: number | null
          id?: string
          kcal_per_100g: number
          last_used_at?: string | null
          name: string
          protein_per_100g: number
          serving_description?: string | null
          serving_grams?: number | null
          source: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          fibre_per_100g?: number | null
          id?: string
          kcal_per_100g?: number
          last_used_at?: string | null
          name?: string
          protein_per_100g?: number
          serving_description?: string | null
          serving_grams?: number | null
          source?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          carbs_g: number | null
          carbs_per_100g: number
          confidence: number | null
          created_at: string
          estimate_source: string
          fat_g: number | null
          fat_per_100g: number
          fibre_g: number | null
          fibre_per_100g: number | null
          food_item_id: string | null
          grams: number
          id: string
          kcal: number | null
          kcal_per_100g: number
          meal_id: string
          name: string
          notes: string | null
          position: number
          protein_g: number | null
          protein_per_100g: number
          quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          carbs_per_100g: number
          confidence?: number | null
          created_at?: string
          estimate_source: string
          fat_g?: number | null
          fat_per_100g: number
          fibre_g?: number | null
          fibre_per_100g?: number | null
          food_item_id?: string | null
          grams: number
          id?: string
          kcal?: number | null
          kcal_per_100g: number
          meal_id: string
          name: string
          notes?: string | null
          position?: number
          protein_g?: number | null
          protein_per_100g: number
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          carbs_per_100g?: number
          confidence?: number | null
          created_at?: string
          estimate_source?: string
          fat_g?: number | null
          fat_per_100g?: number
          fibre_g?: number | null
          fibre_per_100g?: number | null
          food_item_id?: string | null
          grams?: number
          id?: string
          kcal?: number | null
          kcal_per_100g?: number
          meal_id?: string
          name?: string
          notes?: string | null
          position?: number
          protein_g?: number | null
          protein_per_100g?: number
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_item_id_user_id_fkey"
            columns: ["food_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_user_id_fkey"
            columns: ["meal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meals: {
        Row: {
          ai_description: string | null
          created_at: string
          id: string
          input_method: string
          local_date: string
          logged_at: string
          meal_type: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_description?: string | null
          created_at?: string
          id?: string
          input_method: string
          local_date: string
          logged_at?: string
          meal_type: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_description?: string | null
          created_at?: string
          id?: string
          input_method?: string
          local_date?: string
          logged_at?: string
          meal_type?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_preferences: string[]
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          height_cm: number | null
          id: string
          locale: string
          onboarded_at: string | null
          sex: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          activity_preferences?: string[]
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          height_cm?: number | null
          id: string
          locale?: string
          onboarded_at?: string | null
          sex?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          activity_preferences?: string[]
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          height_cm?: number | null
          id?: string
          locale?: string
          onboarded_at?: string | null
          sex?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          calories_kcal: number | null
          carbs_g: number | null
          created_at: string
          effective_from: string
          fat_g: number | null
          fitness_goal: string | null
          id: string
          protein_g: number | null
          target_waist_cm: number | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weekly_activity_minutes: number | null
        }
        Insert: {
          calories_kcal?: number | null
          carbs_g?: number | null
          created_at?: string
          effective_from: string
          fat_g?: number | null
          fitness_goal?: string | null
          id?: string
          protein_g?: number | null
          target_waist_cm?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weekly_activity_minutes?: number | null
        }
        Update: {
          calories_kcal?: number | null
          carbs_g?: number | null
          created_at?: string
          effective_from?: string
          fat_g?: number | null
          fitness_goal?: string | null
          id?: string
          protein_g?: number | null
          target_waist_cm?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weekly_activity_minutes?: number | null
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          exercise_id: string | null
          exercise_name: string
          exercise_order: number
          id: string
          notes: string | null
          reps: number | null
          set_number: number
          updated_at: string
          user_id: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name: string
          exercise_order: number
          id?: string
          notes?: string | null
          reps?: number | null
          set_number: number
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name?: string
          exercise_order?: number
          id?: string
          notes?: string | null
          reps?: number | null
          set_number?: number
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_user_id_fkey"
            columns: ["exercise_id", "user_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_user_id_fkey"
            columns: ["workout_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          duration_seconds: number | null
          estimated_kcal_burned: number | null
          id: string
          kcal_source: string | null
          local_date: string
          notes: string | null
          started_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          estimated_kcal_burned?: number | null
          id?: string
          kcal_source?: string | null
          local_date: string
          notes?: string | null
          started_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          estimated_kcal_burned?: number | null
          id?: string
          kcal_source?: string | null
          local_date?: string
          notes?: string | null
          started_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_nutrition: {
        Row: {
          carbs_g: number | null
          fat_g: number | null
          fibre_g: number | null
          has_ai_estimates: boolean | null
          item_count: number | null
          kcal: number | null
          local_date: string | null
          meal_count: number | null
          protein_g: number | null
          user_id: string | null
        }
        Relationships: []
      }
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
