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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_sets: {
        Row: {
          bid_strategy: string | null
          billing_event: string | null
          campaign_id: string
          clicks: number | null
          company_id: string
          created_at: string | null
          daily_budget: number | null
          destination_type: string | null
          effective_status: string | null
          end_time: string | null
          external_id: string
          frequency_control: Json | null
          id: string
          impressions: number | null
          learning_stage: string | null
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          platform: string
          spend: number | null
          start_time: string | null
          status: string
          targeting: Json | null
          updated_at: string | null
        }
        Insert: {
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id: string
          clicks?: number | null
          company_id: string
          created_at?: string | null
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id: string
          frequency_control?: Json | null
          id?: string
          impressions?: number | null
          learning_stage?: string | null
          lifetime_budget?: number | null
          name: string
          optimization_goal?: string | null
          platform: string
          spend?: number | null
          start_time?: string | null
          status: string
          targeting?: Json | null
          updated_at?: string | null
        }
        Update: {
          bid_strategy?: string | null
          billing_event?: string | null
          campaign_id?: string
          clicks?: number | null
          company_id?: string
          created_at?: string | null
          daily_budget?: number | null
          destination_type?: string | null
          effective_status?: string | null
          end_time?: string | null
          external_id?: string
          frequency_control?: Json | null
          id?: string
          impressions?: number | null
          learning_stage?: string | null
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          platform?: string
          spend?: number | null
          start_time?: string | null
          status?: string
          targeting?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_history: {
        Row: {
          assistant_message: string
          company_id: string
          context: string | null
          created_at: string | null
          id: string
          tokens_used: number | null
          user_id: string
          user_message: string
        }
        Insert: {
          assistant_message: string
          company_id: string
          context?: string | null
          created_at?: string | null
          id?: string
          tokens_used?: number | null
          user_id: string
          user_message: string
        }
        Update: {
          assistant_message?: string
          company_id?: string
          context?: string | null
          created_at?: string | null
          id?: string
          tokens_used?: number | null
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          api_key: string | null
          created_at: string | null
          id: string
          is_configured: boolean | null
          max_tokens: number | null
          model: string | null
          provider: string | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          max_tokens?: number | null
          model?: string | null
          provider?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          max_tokens?: number | null
          model?: string | null
          provider?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string | null
          creative_id: string | null
          id: string
          suggestions: Json
          tokens_used: number | null
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string | null
          creative_id?: string | null
          id?: string
          suggestions: Json
          tokens_used?: number | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string | null
          creative_id?: string | null
          id?: string
          suggestions?: Json
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_actions: {
        Row: {
          action: string
          audit_id: string
          company_id: string
          created_at: string | null
          executed_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          action: string
          audit_id: string
          company_id: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          action?: string
          audit_id?: string
          company_id?: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_actions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          ad_set_id: string | null
          ai_analysis: Json | null
          audit_focus: string
          audit_level: string
          campaign_id: string | null
          company_id: string
          compliance_score: number
          created_at: string | null
          creative_id: string | null
          id: string
          issues: Json | null
          performance_score: number
          policy_id: string | null
          recommendations: Json | null
          status: string
        }
        Insert: {
          ad_set_id?: string | null
          ai_analysis?: Json | null
          audit_focus?: string
          audit_level?: string
          campaign_id?: string | null
          company_id: string
          compliance_score: number
          created_at?: string | null
          creative_id?: string | null
          id?: string
          issues?: Json | null
          performance_score: number
          policy_id?: string | null
          recommendations?: Json | null
          status: string
        }
        Update: {
          ad_set_id?: string | null
          ai_analysis?: Json | null
          audit_focus?: string
          audit_level?: string
          campaign_id?: string | null
          company_id?: string
          compliance_score?: number
          created_at?: string | null
          creative_id?: string | null
          id?: string
          issues?: Json | null
          performance_score?: number
          policy_id?: string | null
          recommendations?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      click_hero_recommendations: {
        Row: {
          audit_id: string | null
          campaign_id: string | null
          category: string
          company_id: string
          created_at: string
          creative_id: string | null
          id: string
          next_step: string
          priority: string
          rationale: string
          source_type: string
          status: string
          title: string
        }
        Insert: {
          audit_id?: string | null
          campaign_id?: string | null
          category: string
          company_id: string
          created_at?: string
          creative_id?: string | null
          id?: string
          next_step?: string
          priority: string
          rationale?: string
          source_type: string
          status?: string
          title: string
        }
        Update: {
          audit_id?: string | null
          campaign_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          creative_id?: string | null
          id?: string
          next_step?: string
          priority?: string
          rationale?: string
          source_type?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "click_hero_recommendations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_hero_recommendations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_hero_recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_hero_recommendations_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          last_triggered_at: string | null
          name: string
          status: string | null
          trigger_conditions: Json
          trigger_count: number | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config: Json
          action_type: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_triggered_at?: string | null
          name: string
          status?: string | null
          trigger_conditions: Json
          trigger_count?: number | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_triggered_at?: string | null
          name?: string
          status?: string | null
          trigger_conditions?: Json
          trigger_count?: number | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_configurations: {
        Row: {
          accent_color: string | null
          brand_guidelines: string | null
          brand_name: string
          company_id: string
          created_at: string | null
          font_family: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name: string
          company_id: string
          created_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string
          company_id?: string
          created_at?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_metrics: {
        Row: {
          campaign_id: string
          clicks: number | null
          company_id: string
          conversion_rate_ranking: string | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string | null
          engagement_rate_ranking: string | null
          frequency: number | null
          id: string
          impressions: number | null
          quality_ranking: string | null
          reach: number | null
          roas: number | null
          spend: number | null
          unique_clicks: number | null
          unique_ctr: number | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          company_id: string
          conversion_rate_ranking?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string | null
          engagement_rate_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          quality_ranking?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          company_id?: string
          conversion_rate_ranking?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string | null
          engagement_rate_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          quality_ranking?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tags: {
        Row: {
          campaign_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advantage_state: string | null
          bid_strategy: string | null
          budget_remaining: number | null
          buying_type: string | null
          clicks: number | null
          company_id: string
          created_at: string | null
          created_time: string | null
          daily_budget: number | null
          effective_status: string | null
          end_time: string | null
          external_id: string
          id: string
          impressions: number | null
          integration_id: string | null
          lifetime_budget: number | null
          name: string
          objective: string | null
          platform: string
          spend: number | null
          spend_cap: number | null
          start_time: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advantage_state?: string | null
          bid_strategy?: string | null
          budget_remaining?: number | null
          buying_type?: string | null
          clicks?: number | null
          company_id: string
          created_at?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          external_id: string
          id?: string
          impressions?: number | null
          integration_id?: string | null
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          platform: string
          spend?: number | null
          spend_cap?: number | null
          start_time?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          advantage_state?: string | null
          bid_strategy?: string | null
          budget_remaining?: number | null
          buying_type?: string | null
          clicks?: number | null
          company_id?: string
          created_at?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          external_id?: string
          id?: string
          impressions?: number | null
          integration_id?: string | null
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          platform?: string
          spend?: number | null
          spend_cap?: number | null
          start_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          max_audits_per_month: number | null
          max_campaigns: number | null
          max_integrations: number | null
          max_users: number | null
          name: string
          plan: string | null
          plan_expires_at: string | null
          primary_color: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_audits_per_month?: number | null
          max_campaigns?: number | null
          max_integrations?: number | null
          max_users?: number | null
          name: string
          plan?: string | null
          plan_expires_at?: string | null
          primary_color?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_audits_per_month?: number | null
          max_campaigns?: number | null
          max_integrations?: number | null
          max_users?: number | null
          name?: string
          plan?: string | null
          plan_expires_at?: string | null
          primary_color?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"] | null
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_criteria: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_text_length: number | null
          min_text_length: number | null
          name: string
          prohibited_keywords: Json | null
          prohibited_phrases: Json | null
          required_keywords: Json | null
          required_phrases: Json | null
          requires_brand_colors: boolean | null
          requires_logo: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_text_length?: number | null
          min_text_length?: number | null
          name: string
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_text_length?: number | null
          min_text_length?: number | null
          name?: string
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_criteria_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_patterns: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          patterns: Json
          period_end: string
          period_start: string
          recommendations: Json
          top_performers: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          patterns: Json
          period_end: string
          period_start: string
          recommendations: Json
          top_performers?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          patterns?: Json
          period_end?: string
          period_start?: string
          recommendations?: Json
          top_performers?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_patterns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_tags: {
        Row: {
          created_at: string | null
          creative_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          creative_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          creative_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_tags_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          ad_set_id: string
          call_to_action: string | null
          campaign_id: string
          carousel_images: Json | null
          clicks: number | null
          color_analysis: Json | null
          company_id: string
          conversions: number | null
          cpc: number | null
          created_at: string | null
          creative_format: string | null
          ctr: number | null
          description: string | null
          detected_media_type: string | null
          external_id: string
          headline: string | null
          id: string
          image_url: string | null
          impressions: number | null
          name: string
          performance_score: number | null
          platform: string
          status: string
          text: string | null
          type: string
          updated_at: string | null
          video_url: string | null
          visual_elements: Json | null
        }
        Insert: {
          ad_set_id: string
          call_to_action?: string | null
          campaign_id: string
          carousel_images?: Json | null
          clicks?: number | null
          color_analysis?: Json | null
          company_id: string
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          creative_format?: string | null
          ctr?: number | null
          description?: string | null
          detected_media_type?: string | null
          external_id: string
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          name: string
          performance_score?: number | null
          platform: string
          status: string
          text?: string | null
          type: string
          updated_at?: string | null
          video_url?: string | null
          visual_elements?: Json | null
        }
        Update: {
          ad_set_id?: string
          call_to_action?: string | null
          campaign_id?: string
          carousel_images?: Json | null
          clicks?: number | null
          color_analysis?: Json | null
          company_id?: string
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          creative_format?: string | null
          ctr?: number | null
          description?: string | null
          detected_media_type?: string | null
          external_id?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          name?: string
          performance_score?: number | null
          platform?: string
          status?: string
          text?: string | null
          type?: string
          updated_at?: string | null
          video_url?: string | null
          visual_elements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_groups: {
        Row: {
          campaign_id: string | null
          cpc_bid_micros: number | null
          google_id: string
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          cpc_bid_micros?: number | null
          google_id: string
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          cpc_bid_micros?: number | null
          google_id?: string
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "google_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads: {
        Row: {
          ad_group_id: string | null
          creative_category: string | null
          creative_elements: Json | null
          descriptions: Json | null
          final_urls: Json | null
          google_id: string
          headlines: Json | null
          id: string
          policy_summary: Json | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          ad_group_id?: string | null
          creative_category?: string | null
          creative_elements?: Json | null
          descriptions?: Json | null
          final_urls?: Json | null
          google_id: string
          headlines?: Json | null
          id?: string
          policy_summary?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_group_id?: string | null
          creative_category?: string | null
          creative_elements?: Json | null
          descriptions?: Json | null
          final_urls?: Json | null
          google_id?: string
          headlines?: Json | null
          id?: string
          policy_summary?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_ad_group_id_fkey"
            columns: ["ad_group_id"]
            isOneToOne: false
            referencedRelation: "google_ad_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      google_auction_insights: {
        Row: {
          campaign_id: string | null
          date: string
          domain: string
          id: string
          impression_share: number | null
          outranking_share: number | null
          overlap_rate: number | null
          position_above_rate: number | null
          top_of_page_rate: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          date: string
          domain: string
          id?: string
          impression_share?: number | null
          outranking_share?: number | null
          overlap_rate?: number | null
          position_above_rate?: number | null
          top_of_page_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          date?: string
          domain?: string
          id?: string
          impression_share?: number | null
          outranking_share?: number | null
          overlap_rate?: number | null
          position_above_rate?: number | null
          top_of_page_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_auction_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "google_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      google_campaigns: {
        Row: {
          advertising_channel_type: string | null
          avg_cpc: number | null
          budget_amount: number | null
          clicks: number | null
          company_id: string | null
          conversions: number | null
          ctr: number | null
          google_id: string
          id: string
          impressions: number | null
          name: string
          spend: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          advertising_channel_type?: string | null
          avg_cpc?: number | null
          budget_amount?: number | null
          clicks?: number | null
          company_id?: string | null
          conversions?: number | null
          ctr?: number | null
          google_id: string
          id?: string
          impressions?: number | null
          name: string
          spend?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          advertising_channel_type?: string | null
          avg_cpc?: number | null
          budget_amount?: number | null
          clicks?: number | null
          company_id?: string | null
          conversions?: number | null
          ctr?: number | null
          google_id?: string
          id?: string
          impressions?: number | null
          name?: string
          spend?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_geo_performance: {
        Row: {
          campaign_id: string | null
          city_criterion_id: string | null
          city_name: string | null
          clicks: number | null
          conversions: number | null
          cost_micros: number | null
          country_criterion_id: string | null
          date: string
          id: string
          impressions: number | null
          region_criterion_id: string | null
          region_name: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          city_criterion_id?: string | null
          city_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_micros?: number | null
          country_criterion_id?: string | null
          date: string
          id?: string
          impressions?: number | null
          region_criterion_id?: string | null
          region_name?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          city_criterion_id?: string | null
          city_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_micros?: number | null
          country_criterion_id?: string | null
          date?: string
          id?: string
          impressions?: number | null
          region_criterion_id?: string | null
          region_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_geo_performance_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "google_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      google_keywords: {
        Row: {
          ad_group_id: string | null
          clicks: number | null
          conversions: number | null
          cost_micros: number | null
          cpc_bid_micros: number | null
          google_id: string
          id: string
          impressions: number | null
          match_type: string | null
          quality_score: number | null
          status: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          ad_group_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_micros?: number | null
          cpc_bid_micros?: number | null
          google_id: string
          id?: string
          impressions?: number | null
          match_type?: string | null
          quality_score?: number | null
          status?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          ad_group_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cost_micros?: number | null
          cpc_bid_micros?: number | null
          google_id?: string
          id?: string
          impressions?: number | null
          match_type?: string | null
          quality_score?: number | null
          status?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_keywords_ad_group_id_fkey"
            columns: ["ad_group_id"]
            isOneToOne: false
            referencedRelation: "google_ad_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheets_config: {
        Row: {
          company_id: string
          created_at: string | null
          credentials: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          sheet_name: string | null
          spreadsheet_id: string | null
          sync_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sheet_name?: string | null
          spreadsheet_id?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sheet_name?: string | null
          spreadsheet_id?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_sheets_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          company_id: string
          created_at: string | null
          id: string
          last_sync_at: string | null
          permissions: Json | null
          platform: string
          refresh_token: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          permissions?: Json | null
          platform: string
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          permissions?: Json | null
          platform?: string
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_rules: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          id: string
          match_type: string
          name: string
          priority: number | null
          tag: string | null
          type: string
          value: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          match_type: string
          name: string
          priority?: number | null
          tag?: string | null
          type: string
          value: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          match_type?: string
          name?: string
          priority?: number | null
          tag?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_sessions: {
        Row: {
          access_token: string
          accounts: Json
          created_at: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          access_token: string
          accounts: Json
          created_at?: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Update: {
          access_token?: string
          accounts?: Json
          created_at?: string | null
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_benchmarks: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          industry: string | null
          metric: string | null
          period: string | null
          platform: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          industry?: string | null
          metric?: string | null
          period?: string | null
          platform?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          metric?: string | null
          period?: string | null
          platform?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_benchmarks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          app_id: string | null
          app_secret: string | null
          created_at: string | null
          id: string
          is_configured: boolean | null
          platform: string
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          platform: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          id?: string
          is_configured?: boolean | null
          platform?: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          accent_color: string | null
          brand_guidelines: string | null
          brand_name: string | null
          campaign_ids: Json | null
          company_id: string
          conversions_min: number | null
          conversions_target: number | null
          cpc_max: number | null
          cpc_target: number | null
          created_at: string | null
          ctr_min: number | null
          ctr_target: number | null
          description: string | null
          id: string
          is_default: boolean | null
          logo_url: string | null
          max_text_length: number | null
          min_text_length: number | null
          name: string
          primary_color: string | null
          prohibited_keywords: Json | null
          prohibited_phrases: Json | null
          required_keywords: Json | null
          required_phrases: Json | null
          requires_brand_colors: boolean | null
          requires_logo: boolean | null
          scope: string | null
          secondary_color: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string | null
          campaign_ids?: Json | null
          company_id: string
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_text_length?: number | null
          min_text_length?: number | null
          name: string
          primary_color?: string | null
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          scope?: string | null
          secondary_color?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_guidelines?: string | null
          brand_name?: string | null
          campaign_ids?: Json | null
          company_id?: string
          conversions_min?: number | null
          conversions_target?: number | null
          cpc_max?: number | null
          cpc_target?: number | null
          created_at?: string | null
          ctr_min?: number | null
          ctr_target?: number | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_text_length?: number | null
          min_text_length?: number | null
          name?: string
          primary_color?: string | null
          prohibited_keywords?: Json | null
          prohibited_phrases?: Json | null
          required_keywords?: Json | null
          required_phrases?: Json | null
          requires_brand_colors?: boolean | null
          requires_logo?: boolean | null
          scope?: string | null
          secondary_color?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_status: {
        Row: {
          is_resolved: boolean | null
          problem_id: string
          updated_at: string | null
        }
        Insert: {
          is_resolved?: boolean | null
          problem_id: string
          updated_at?: string | null
        }
        Update: {
          is_resolved?: boolean | null
          problem_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          company_id: string
          created_at: string | null
          data: Json | null
          date_from: string
          date_to: string
          id: string
          report_type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          data?: Json | null
          date_from: string
          date_to: string
          id?: string
          report_type: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          data?: Json | null
          date_from?: string
          date_to?: string
          id?: string
          report_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      search_terms: {
        Row: {
          ad_group_id: string | null
          campaign_id: string | null
          company_id: string
          created_at: string | null
          date: string | null
          id: string
          metrics: Json | null
          term: string
        }
        Insert: {
          ad_group_id?: string | null
          campaign_id?: string | null
          company_id: string
          created_at?: string | null
          date?: string | null
          id?: string
          metrics?: Json | null
          term: string
        }
        Update: {
          ad_group_id?: string | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string | null
          date?: string | null
          id?: string
          metrics?: Json | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          annual_pricing: number | null
          billing_cycle: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          enable_trial: boolean | null
          features: Json | null
          id: string
          investment_range: string | null
          is_active: boolean | null
          is_popular: boolean | null
          max_audits_per_month: number
          max_campaigns: number
          max_integrations: number | null
          max_users: number
          monthly_pricing: number | null
          name: string
          price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          annual_pricing?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          enable_trial?: boolean | null
          features?: Json | null
          id?: string
          investment_range?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          max_audits_per_month: number
          max_campaigns: number
          max_integrations?: number | null
          max_users: number
          monthly_pricing?: number | null
          name: string
          price: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          annual_pricing?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          enable_trial?: boolean | null
          features?: Json | null
          id?: string
          investment_range?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          max_audits_per_month?: number
          max_campaigns?: number
          max_integrations?: number | null
          max_users?: number
          monthly_pricing?: number | null
          name?: string
          price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_history: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          items_failed: number | null
          items_synced: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          items_failed?: number | null
          items_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          items_failed?: number | null
          items_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_history_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          company_id: string
          created_at: string | null
          entity_type: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string | null
          entity_type: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string | null
          entity_type?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          password_hash: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password_hash: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          password_hash?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      company_status: "active" | "suspended" | "trial" | "cancelled"
      notification_type:
        | "audit_completed"
        | "audit_failed"
        | "policy_violation"
        | "sync_completed"
        | "sync_failed"
        | "system_alert"
        | "welcome"
      subscription_plan: "free" | "starter" | "professional" | "enterprise"
      user_role: "super_admin" | "company_admin" | "operador"
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
      company_status: ["active", "suspended", "trial", "cancelled"],
      notification_type: [
        "audit_completed",
        "audit_failed",
        "policy_violation",
        "sync_completed",
        "sync_failed",
        "system_alert",
        "welcome",
      ],
      subscription_plan: ["free", "starter", "professional", "enterprise"],
      user_role: ["super_admin", "company_admin", "operador"],
    },
  },
} as const
