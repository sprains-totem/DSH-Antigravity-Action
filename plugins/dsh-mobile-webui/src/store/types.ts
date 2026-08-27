export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  reasoningTokens?: number;
}

export interface SessionStats {
  turns?: number;
  steps?: number;
  llmMs?: number;
  toolMs?: number;
  ttftMs?: number;
  ttftSteps?: number;
  decodeMs?: number;
  decodeTokens?: number;
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface GoalData {
  id: string;
  revision: number;
  objective: string;
  phase: string;
  roundsStarted?: number;
  maxGoalRounds?: number;
}

export interface PermissionOption {
  value: string;
  name: string;
  description?: string;
}

export interface SessionMetadata {
  sessionId: string;
  title: string;
  updatedAt: number;
  running: boolean;
  blank: boolean;
  cwd: string;
  agentPreset?: string;
  todos?: TodoItem[] | null;
  goal?: GoalData | null;
  tokenUsage?: {
    uncachedInputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
  };
  permissions?: {
    options: PermissionOption[];
    currentValue: string;
  };
  sessionStats?: SessionStats;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ReasoningBlock {
  type: 'reasoning';
  text: string;
}

export interface ToolCallBlock {
  type: 'tool-call';
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResultBlock {
  type: 'tool-result';
  toolCallId: string;
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ReasoningBlock | ToolCallBlock | ToolResultBlock;

export interface ToolExecution {
  callId: string;
  name: string;
  arguments: string;
  result?: string;
  isError?: boolean;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
}

export interface StepRecord {
  turn: number;
  step: number;
  reasoning: string;
  isReasoningStreaming: boolean;
  assistantText: string;
  isTextStreaming: boolean;
  toolCalls: ToolExecution[];
  usage?: TokenUsage;
  status: 'running' | 'completed' | 'error';
}

export interface TurnRecord {
  turn: number;
  userMessage?: {
    id: string;
    text: string;
    images?: string[];
    timestamp: number;
    status: 'sending' | 'sent' | 'error';
  };
  steps: StepRecord[];
  status: 'running' | 'completed' | 'error';
}

export interface ApprovalRequest {
  id: string;
  rpcId?: string;
  sessionId: string;
  toolName: string;
  callId?: string;
  reason?: string;
}

export interface QuestionItem {
  id: string;
  question: string;
  header?: string;
  detail?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface UserQuestionRequest {
  rpcId: string;
  sessionId: string;
  questions: QuestionItem[];
}

export interface SubagentItem {
  sessionId: string;
  parentSessionId: string;
  title: string;
  activity: 'running' | 'inactive';
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
}
