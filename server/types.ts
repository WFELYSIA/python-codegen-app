export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface PublicApiConfig extends Omit<ApiConfig, "apiKey"> {
  hasApiKey: boolean;
}

export interface UpdateConfigRequest {
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface UpstreamMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStreamRequest {
  conversationId?: string;
  messages: ChatRequestMessage[];
}
