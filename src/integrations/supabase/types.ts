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
      clientes: {
        Row: {
          cep: string | null
          complemento: string | null
          created_at: string
          distribuidora_id: string
          endereco: string | null
          id: string
          nome: string
          telefone: string
        }
        Insert: {
          cep?: string | null
          complemento?: string | null
          created_at?: string
          distribuidora_id: string
          endereco?: string | null
          id?: string
          nome: string
          telefone: string
        }
        Update: {
          cep?: string | null
          complemento?: string | null
          created_at?: string
          distribuidora_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuidoras: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string
          horario_abertura: string
          horario_fechamento: string
          id: string
          logo_url: string | null
          logradouro: string | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          owner_user_id: string
          plano: Database["public"]["Enums"]["plano_tipo"]
          razao_social: string | null
          slug: string | null
          status_assinatura: Database["public"]["Enums"]["status_assinatura_tipo"]
          taxa_entrega_padrao: number
          telefone: string | null
          tempo_estimado_min: number
          trial_expires_at: string
          uf: string | null
          updated_at: string
          verificacao_whatsapp: boolean
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email: string
          horario_abertura?: string
          horario_fechamento?: string
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_user_id: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          razao_social?: string | null
          slug?: string | null
          status_assinatura?: Database["public"]["Enums"]["status_assinatura_tipo"]
          taxa_entrega_padrao?: number
          telefone?: string | null
          tempo_estimado_min?: number
          trial_expires_at?: string
          uf?: string | null
          updated_at?: string
          verificacao_whatsapp?: boolean
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string
          horario_abertura?: string
          horario_fechamento?: string
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_user_id?: string
          plano?: Database["public"]["Enums"]["plano_tipo"]
          razao_social?: string | null
          slug?: string | null
          status_assinatura?: Database["public"]["Enums"]["status_assinatura_tipo"]
          taxa_entrega_padrao?: number
          telefone?: string | null
          tempo_estimado_min?: number
          trial_expires_at?: string
          uf?: string | null
          updated_at?: string
          verificacao_whatsapp?: boolean
        }
        Relationships: []
      }
      entregadores: {
        Row: {
          created_at: string
          distribuidora_id: string
          id: string
          nome: string
          status: Database["public"]["Enums"]["entregador_status"]
          telefone: string | null
          updated_at: string
          user_id: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
        }
        Insert: {
          created_at?: string
          distribuidora_id: string
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["entregador_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
        }
        Update: {
          created_at?: string
          distribuidora_id?: string
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["entregador_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionamento: {
        Row: {
          created_at: string
          dia_semana: number
          distribuidora_id: string
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          is_fechado_o_dia_todo: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          distribuidora_id: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          is_fechado_o_dia_todo?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          distribuidora_id?: string
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          is_fechado_o_dia_todo?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionamento_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_pagamento: {
        Row: {
          access_token: string | null
          conectado_em: string | null
          created_at: string
          distribuidora_id: string
          id: string
          mp_user_id: string | null
          provedor: string
          refresh_token: string | null
          token_expira_em: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          conectado_em?: string | null
          created_at?: string
          distribuidora_id: string
          id?: string
          mp_user_id?: string | null
          provedor?: string
          refresh_token?: string | null
          token_expira_em?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          conectado_em?: string | null
          created_at?: string
          distribuidora_id?: string
          id?: string
          mp_user_id?: string | null
          provedor?: string
          refresh_token?: string | null
          token_expira_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_pagamento_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: true
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_whatsapp: {
        Row: {
          created_at: string
          distribuidora_id: string
          id: string
          mensagem: string
          pedido_id: string
          provider_response: Json | null
          status: string
          telefone: string
          tipo: string
        }
        Insert: {
          created_at?: string
          distribuidora_id: string
          id?: string
          mensagem: string
          pedido_id: string
          provider_response?: Json | null
          status?: string
          telefone: string
          tipo: string
        }
        Update: {
          created_at?: string
          distribuidora_id?: string
          id?: string
          mensagem?: string
          pedido_id?: string
          provider_response?: Json | null
          status?: string
          telefone?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_whatsapp_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_whatsapp_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          distribuidora_id: string
          expira_em: string
          state: string
        }
        Insert: {
          created_at?: string
          distribuidora_id: string
          expira_em: string
          state: string
        }
        Update: {
          created_at?: string
          distribuidora_id?: string
          expira_em?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verificacoes: {
        Row: {
          codigo_hash: string
          created_at: string
          distribuidora_id: string
          expira_em: string
          id: string
          telefone: string
          tentativas: number
          token: string | null
          verificado_at: string | null
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          distribuidora_id: string
          expira_em: string
          id?: string
          telefone: string
          tentativas?: number
          token?: string | null
          verificado_at?: string | null
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          distribuidora_id?: string
          expira_em?: string
          id?: string
          telefone?: string
          tentativas?: number
          token?: string | null
          verificado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_verificacoes_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          id: string
          pedido_id: string
          preco_unit: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          id?: string
          pedido_id: string
          preco_unit: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          id?: string
          pedido_id?: string
          preco_unit?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          codigo_pix: string | null
          created_at: string
          distribuidora_id: string
          entregador_id: string | null
          entregue_at: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          is_pre_order: boolean
          mp_payment_id: string | null
          observacoes: string | null
          pago_at: string | null
          pix_qr_base64: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          subtotal: number
          taxa_entrega: number
          total: number
        }
        Insert: {
          cliente_id: string
          codigo_pix?: string | null
          created_at?: string
          distribuidora_id: string
          entregador_id?: string | null
          entregue_at?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          is_pre_order?: boolean
          mp_payment_id?: string | null
          observacoes?: string | null
          pago_at?: string | null
          pix_qr_base64?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          subtotal?: number
          taxa_entrega?: number
          total?: number
        }
        Update: {
          cliente_id?: string
          codigo_pix?: string | null
          created_at?: string
          distribuidora_id?: string
          entregador_id?: string | null
          entregue_at?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          is_pre_order?: boolean
          mp_payment_id?: string | null
          observacoes?: string | null
          pago_at?: string | null
          pix_qr_base64?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          subtotal?: number
          taxa_entrega?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          distribuidora_id: string
          estoque: number
          estoque_minimo: number
          id: string
          marca: string | null
          nome: string
          preco: number
          tipo_embalagem: string | null
          volume_unidade: string | null
          volume_valor: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          distribuidora_id: string
          estoque?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          nome: string
          preco: number
          tipo_embalagem?: string | null
          volume_unidade?: string | null
          volume_valor?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          distribuidora_id?: string
          estoque?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          nome?: string
          preco?: number
          tipo_embalagem?: string | null
          volume_unidade?: string | null
          volume_valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          distribuidora_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          distribuidora_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          distribuidora_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_distribuidora_id_fkey"
            columns: ["distribuidora_id"]
            isOneToOne: false
            referencedRelation: "distribuidoras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_unique_slug: {
        Args: { _base: string; _self: string }
        Returns: string
      }
      get_user_distribuidora_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      slugify: { Args: { v: string }; Returns: string }
    }
    Enums: {
      app_role: "admin_master" | "distribuidora" | "entregador"
      entregador_status: "disponivel" | "em_entrega" | "inativo"
      forma_pagamento: "pix" | "cartao" | "dinheiro"
      pedido_status:
        | "pendente"
        | "preparo"
        | "pago"
        | "rota"
        | "entregue"
        | "cancelado"
      plano_tipo: "free" | "pro" | "business"
      status_assinatura_tipo: "ativo" | "suspenso" | "cancelado"
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
      app_role: ["admin_master", "distribuidora", "entregador"],
      entregador_status: ["disponivel", "em_entrega", "inativo"],
      forma_pagamento: ["pix", "cartao", "dinheiro"],
      pedido_status: [
        "pendente",
        "preparo",
        "pago",
        "rota",
        "entregue",
        "cancelado",
      ],
      plano_tipo: ["free", "pro", "business"],
      status_assinatura_tipo: ["ativo", "suspenso", "cancelado"],
    },
  },
} as const
