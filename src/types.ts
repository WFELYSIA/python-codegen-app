export type MessageRole = "user" | "assistant";
export type MessageStatus = "pending" | "streaming" | "done" | "error";

export interface MessageAttachment {
  name: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  attachments?: MessageAttachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface PublicApiConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingLevel: number;
  systemPrompt: string;
  hasApiKey: boolean;
}

export interface ApiConfigForm {
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
