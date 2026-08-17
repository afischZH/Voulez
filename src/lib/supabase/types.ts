// Generiert aus dem Supabase-Schema. Nicht von Hand ändern.
// Neu erzeugen: npx supabase gen types typescript --project-id kivmcjlrepexusiagtac

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      date_options: {
        Row: {
          description: string | null
          icon: string
          id: string
          label: string
          position: number
          vault_id: string
        }
        Insert: {
          description?: string | null
          icon?: string
          id?: string
          label: string
          position: number
          vault_id: string
        }
        Update: {
          description?: string | null
          icon?: string
          id?: string
          label?: string
          position?: number
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'date_options_vault_id_fkey'
            columns: ['vault_id']
            isOneToOne: false
            referencedRelation: 'vaults'
            referencedColumns: ['id']
          },
        ]
      }
      date_slots: {
        Row: {
          day: string
          id: string
          time_from: string
          time_to: string
          vault_id: string
        }
        Insert: {
          day: string
          id?: string
          time_from: string
          time_to: string
          vault_id: string
        }
        Update: {
          day?: string
          id?: string
          time_from?: string
          time_to?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'date_slots_vault_id_fkey'
            columns: ['vault_id']
            isOneToOne: false
            referencedRelation: 'vaults'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limits: {
        Row: { bucket: string; hits: number; window_start: string }
        Insert: { bucket: string; hits?: number; window_start?: string }
        Update: { bucket?: string; hits?: number; window_start?: string }
        Relationships: []
      }
      responses: {
        Row: {
          accepted: boolean
          created_at: string
          custom_label: string | null
          custom_time: boolean
          duration_min: number
          id: string
          message: string | null
          option_id: string | null
          starts_at: string | null
          ticket_token_hash: string | null
          vault_id: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          custom_label?: string | null
          custom_time?: boolean
          duration_min?: number
          id?: string
          message?: string | null
          option_id?: string | null
          starts_at?: string | null
          ticket_token_hash?: string | null
          vault_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          custom_label?: string | null
          custom_time?: boolean
          duration_min?: number
          id?: string
          message?: string | null
          option_id?: string | null
          starts_at?: string | null
          ticket_token_hash?: string | null
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'responses_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'date_options'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'responses_vault_id_fkey'
            columns: ['vault_id']
            isOneToOne: true
            referencedRelation: 'vaults'
            referencedColumns: ['id']
          },
        ]
      }
      vault_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          vault_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          vault_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vault_events_vault_id_fkey'
            columns: ['vault_id']
            isOneToOne: false
            referencedRelation: 'vaults'
            referencedColumns: ['id']
          },
        ]
      }
      vault_puzzles: {
        Row: {
          config: Json
          created_at: string
          hint_text: string | null
          id: string
          position: number
          reveal_digit: string
          title: string | null
          type: string
          vault_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          hint_text?: string | null
          id?: string
          position: number
          reveal_digit: string
          title?: string | null
          type: string
          vault_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          hint_text?: string | null
          id?: string
          position?: number
          reveal_digit?: string
          title?: string | null
          type?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vault_puzzles_vault_id_fkey'
            columns: ['vault_id']
            isOneToOne: false
            referencedRelation: 'vaults'
            referencedColumns: ['id']
          },
        ]
      }
      vaults: {
        Row: {
          allow_custom_proposal: boolean
          closing_text: string | null
          confirm_token_hash: string | null
          confirmed_at: string | null
          created_at: string
          creator_email: string
          creator_name: string | null
          edit_token_hash: string
          expires_at: string
          failed_attempts: number
          id: string
          intro_text: string | null
          invitation_sent_at: string | null
          locked_until: string | null
          pin_hash: string
          pin_length: number
          recipient_email: string | null
          recipient_name: string
          reveal_text: string
          slug: string
          status: string
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_custom_proposal?: boolean
          closing_text?: string | null
          confirm_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          creator_email: string
          creator_name?: string | null
          edit_token_hash: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          intro_text?: string | null
          invitation_sent_at?: string | null
          locked_until?: string | null
          pin_hash: string
          pin_length?: number
          recipient_email?: string | null
          recipient_name: string
          reveal_text: string
          slug: string
          status?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_custom_proposal?: boolean
          closing_text?: string | null
          confirm_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          creator_email?: string
          creator_name?: string | null
          edit_token_hash?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          intro_text?: string | null
          invitation_sent_at?: string | null
          locked_until?: string | null
          pin_hash?: string
          pin_length?: number
          recipient_email?: string | null
          recipient_name?: string
          reveal_text?: string
          slug?: string
          status?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hit_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window: string }
        Returns: boolean
      }
      register_failed_unlock: { Args: { p_vault_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
