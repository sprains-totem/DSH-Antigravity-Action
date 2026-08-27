import { DshClient } from './client';
import {
  ApprovalRequest,
  ConnectionState,
  GoalData,
  ModelCatalogItem,
  SessionMetadata,
  StepRecord,
  SubagentItem,
  TodoItem,
  ToolExecution,
  TurnRecord,
  UserQuestionRequest,
} from './types';

type Listener = () => void;

class StateStore {
  public client: DshClient;
  public connectionState: ConnectionState = 'offline';
  public sessions: SessionMetadata[] = [];
  public currentSessionId: string | null = null;
  public turns: TurnRecord[] = [];
  public isGenerating = false;

  // Active inspectors & drawers
  public isDrawerOpen = false;
  public isModelPickerOpen = false;
  public isTodoDrawerOpen = false;
  public isToolInspectorOpen = false;
  public isSessionSettingsOpen = false;
  public isSettingsOpen = false;
  public activeTool: ToolExecution | null = null;

  // Human in the Loop & Subagents
  public pendingApproval: ApprovalRequest | null = null;
  public pendingQuestion: UserQuestionRequest | null = null;
  public subagents: SubagentItem[] = [];
  public todos: TodoItem[] = [];
  public goal: GoalData | null = null;

  // Models & Permissions
  public models: ModelCatalogItem[] = [];
  public currentModel: { provider: string; model: string } = { provider: 'antigravity', model: 'gemini-3.7-flash-high' };
  public currentPermission = 'danger-full-access';

  private listeners: Set<Listener> = new Set();
  private historyLoading = false;

  constructor() {
    this.client = new DshClient();
    this.setupClientHandlers();
    (window as any).__DSH_STATE__ = this;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try { listener(); } catch (e) { console.error(e); }
    }
  }

  public async init() {
    this.client.onStateChange = (state) => {
      this.connectionState = state;
      this.notify();
      if (state === 'connected') {
        this.refreshSessions();
        if (this.currentSessionId) {
          this.loadSessionHistory(this.currentSessionId);
        }
      }
    };

    this.client.start();
    await this.refreshSessions();

    if (this.sessions.length > 0 && !this.currentSessionId) {
      const savedId = localStorage.getItem('dsh_mobile_active_session');
      const target = this.sessions.find(s => s.sessionId === savedId) || this.sessions[0];
      await this.selectSession(target.sessionId);
    }
  }

  private setupClientHandlers() {
    this.client.onMuxFrame = (payload, rpcId) => {
      this.handleMuxFrame(payload, rpcId);
    };

    this.client.onHostFrame = (payload) => {
      if (payload.type === 'host/remote-event') {
        this.refreshSessions();
      }
    };
  }

  private handleMuxFrame(payload: any, rpcId?: string) {
    if (!payload || typeof payload !== 'object') return;

    // 1. Session Event
    if (payload.type === 'session/event' && payload.sessionId === this.currentSessionId) {
      this.processSessionEvent(payload.event);
      this.notify();
      return;
    }

    // 2. Session Projections
    if (payload.type === 'session/projection' && payload.sessionId === this.currentSessionId) {
      this.applyProjection(payload.key, payload.value);
      this.notify();
      return;
    }

    // 3. Approvals
    if (payload.type === 'approval/requested' && payload.sessionId === this.currentSessionId) {
      this.pendingApproval = {
        id: payload.approvalId,
        rpcId,
        sessionId: payload.sessionId,
        toolName: payload.toolName,
        callId: payload.callId,
        reason: payload.reason,
      };
      this.notify();
      return;
    }

    if (payload.type === 'approval/resolved' && payload.sessionId === this.currentSessionId) {
      if (this.pendingApproval && this.pendingApproval.id === payload.approvalId) {
        this.pendingApproval = null;
        this.notify();
      }
      return;
    }

    // 4. User Questions
    if (payload.type === 'question/requested' && payload.sessionId === this.currentSessionId) {
      this.pendingQuestion = {
        rpcId: rpcId || '',
        sessionId: payload.sessionId,
        questions: payload.questions || [],
      };
      this.notify();
      return;
    }

    if (payload.type === 'question/resolved' && payload.sessionId === this.currentSessionId) {
      if (this.pendingQuestion && this.pendingQuestion.rpcId === payload.questionRpcId) {
        this.pendingQuestion = null;
        this.notify();
      }
      return;
    }
  }

  private applyProjection(key: string, value: any) {
    if (!value) return;
    if (key === 'todos') {
      this.todos = Array.isArray(value) ? value : [];
    } else if (key === 'goal') {
      this.goal = value?.goal || value;
    } else if (key === 'permissions') {
      this.currentPermission = value.currentValue || this.currentPermission;
    } else if (key === 'title') {
      const current = this.getCurrentSession();
      if (current) current.title = value;
    }
  }

  public async refreshSessions() {
    try {
      const res = await this.client.rpc<{ items: any[] }>('session.list');
      if (res && Array.isArray(res.items)) {
        this.sessions = res.items.map((item) => ({
          sessionId: item.sessionId,
          title: item.projections?.values?.title || '新会话',
          updatedAt: item.updatedAt || Date.now(),
          running: item.running === true,
          blank: item.blank === true,
          cwd: item.cwd || '',
          agentPreset: item.agentPreset,
          todos: item.projections?.values?.todos,
          goal: item.projections?.values?.goal?.goal,
          tokenUsage: item.projections?.values?.tokenUsage,
          permissions: item.projections?.values?.permissions,
          sessionStats: item.projections?.values?.sessionStats,
        })).sort((a, b) => b.updatedAt - a.updatedAt);

        const active = this.getCurrentSession();
        if (active) {
          this.isGenerating = active.running;
          if (active.todos) this.todos = active.todos;
          if (active.goal) this.goal = active.goal;
          if (active.permissions) this.currentPermission = active.permissions.currentValue;
        }

        this.notify();
      }
    } catch (e) {
      console.error('[mobile-state] refreshSessions error:', e);
    }
  }

  public async selectSession(sessionId: string) {
    this.currentSessionId = sessionId;
    localStorage.setItem('dsh_mobile_active_session', sessionId);
    this.turns = [];
    this.pendingApproval = null;
    this.pendingQuestion = null;
    this.isDrawerOpen = false;

    const session = this.getCurrentSession();
    if (session) {
      this.isGenerating = session.running;
      this.todos = session.todos || [];
      this.goal = session.goal || null;
      if (session.permissions) this.currentPermission = session.permissions.currentValue;
    }

    this.notify();
    await this.loadSessionHistory(sessionId);
    await this.loadSessionModels(sessionId);
  }

  public async createSession(): Promise<string | null> {
    try {
      const res = await this.client.rpc<{ sessionId: string }>('session.create', {});
      if (res && res.sessionId) {
        await this.refreshSessions();
        await this.selectSession(res.sessionId);
        return res.sessionId;
      }
    } catch (e) {
      console.error('[mobile-state] createSession error:', e);
    }
    return null;
  }

  public async deleteSession(sessionId: string) {
    try {
      await this.client.rpc('session.delete', { sessionId });
      this.sessions = this.sessions.filter(s => s.sessionId !== sessionId);
      if (this.currentSessionId === sessionId) {
        if (this.sessions.length > 0) {
          await this.selectSession(this.sessions[0].sessionId);
        } else {
          this.currentSessionId = null;
          this.turns = [];
          this.notify();
        }
      } else {
        this.notify();
      }
    } catch (e) {
      console.error('[mobile-state] deleteSession error:', e);
    }
  }

  public async loadSessionHistory(sessionId: string) {
    if (this.historyLoading) return;
    this.historyLoading = true;

    try {
      const res = await this.client.rpc<{ events: any[] }>('session.history', {
        sessionId,
        maxMessages: 500,
      });
      if (res && Array.isArray(res.events)) {
        this.parseFullHistory(res.events);
      }
    } catch (e) {
      console.error('[mobile-state] loadSessionHistory error:', e);
    } finally {
      this.historyLoading = false;
      this.notify();
    }
  }

  private parseFullHistory(rawEvents: any[]) {
    this.turns = [];
    for (const item of rawEvents) {
      const ev = item.event || item;
      this.processSessionEvent(ev);
    }
  }

  private ensureTurn(turnNum?: number): TurnRecord {
    if (turnNum !== undefined) {
      let found = this.turns.find(t => t.turn === turnNum);
      if (found) return found;
      const newTurn: TurnRecord = {
        turn: turnNum,
        steps: [],
        status: 'running',
      };
      this.turns.push(newTurn);
      this.turns.sort((a, b) => a.turn - b.turn);
      return newTurn;
    }

    if (this.turns.length === 0) {
      const initial: TurnRecord = {
        turn: 1,
        steps: [],
        status: 'running',
      };
      this.turns.push(initial);
      return initial;
    }
    return this.turns[this.turns.length - 1];
  }

  private ensureStep(turn: TurnRecord, stepNum?: number): StepRecord {
    if (stepNum !== undefined) {
      let found = turn.steps.find(s => s.step === stepNum);
      if (found) return found;
      const newStep: StepRecord = {
        turn: turn.turn,
        step: stepNum,
        reasoning: '',
        isReasoningStreaming: false,
        assistantText: '',
        isTextStreaming: false,
        toolCalls: [],
        status: 'running',
      };
      turn.steps.push(newStep);
      turn.steps.sort((a, b) => a.step - b.step);
      return newStep;
    }

    if (turn.steps.length === 0) {
      const initial: StepRecord = {
        turn: turn.turn,
        step: 1,
        reasoning: '',
        isReasoningStreaming: false,
        assistantText: '',
        isTextStreaming: false,
        toolCalls: [],
        status: 'running',
      };
      turn.steps.push(initial);
      return initial;
    }
    return turn.steps[turn.steps.length - 1];
  }

  private processSessionEvent(ev: any) {
    if (!ev || !ev.type) return;

    // 1. Turn Lifecycle Start
    if (ev.type === 'turn/start') {
      const turnNum = ev.data?.turn;
      this.ensureTurn(turnNum);
      return;
    }

    // 2. User Message (always belongs to the current open turn!)
    if (ev.type === 'user/message') {
      const data = ev.data;
      if (data && data.source && data.source.kind === 'user') {
        const textBlocks = data.content?.filter((c: any) => c.type === 'text') || [];
        const text = textBlocks.map((c: any) => c.text).join('\n');
        const images = data.content?.filter((c: any) => c.type === 'image')?.map((c: any) => c.previewUrl || c.data || '') || [];

        // Attach to the latest turn or create one if empty
        const turn = this.turns.length > 0 ? this.turns[this.turns.length - 1] : this.ensureTurn(1);

        const optimistic = this.turns.find(t => t.userMessage?.status === 'sending' && t.userMessage?.text === text);
        if (optimistic && optimistic.userMessage) {
          optimistic.userMessage.status = 'sent';
          optimistic.userMessage.id = data.id || optimistic.userMessage.id;
          optimistic.userMessage.timestamp = ev.time || optimistic.userMessage.timestamp;
        } else {
          turn.userMessage = {
            id: data.id || `msg_${Date.now()}`,
            text,
            images,
            timestamp: ev.time || Date.now(),
            status: 'sent',
          };
        }
      }
      return;
    }

    // 3. Step Start
    if (ev.type === 'step/start') {
      const turn = this.ensureTurn(ev.data?.turn);
      this.ensureStep(turn, ev.data?.step);
      return;
    }

    const currentTurn = this.ensureTurn(ev.data?.turn);
    const currentStep = this.ensureStep(currentTurn, ev.data?.step);

    // 4. Assistant Chunk
    if (ev.type === 'assistant/chunk') {
      const chunk = ev.data?.chunk;
      if (!chunk) return;

      if (chunk.type === 'reasoning-delta') {
        currentStep.reasoning += chunk.text || '';
        currentStep.isReasoningStreaming = true;
      } else if (chunk.type === 'text-delta') {
        currentStep.assistantText += chunk.text || '';
        currentStep.isTextStreaming = true;
        currentStep.isReasoningStreaming = false;
      } else if (chunk.type === 'tool-call-delta') {
        const callId = chunk.id;
        let tool = currentStep.toolCalls.find(t => t.callId === callId);
        if (!tool && callId) {
          tool = {
            callId,
            name: chunk.name || '',
            arguments: chunk.argumentsDelta || '',
            status: 'running',
            startTime: ev.time || Date.now(),
          };
          currentStep.toolCalls.push(tool);
        } else if (tool && chunk.argumentsDelta) {
          tool.arguments += chunk.argumentsDelta;
        }
      } else if (chunk.type === 'finish') {
        currentStep.isReasoningStreaming = false;
        currentStep.isTextStreaming = false;
      }
      return;
    }

    // 5. Assistant Message
    if (ev.type === 'assistant/message') {
      const data = ev.data;
      if (data?.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'reasoning') {
            currentStep.reasoning = block.text;
          } else if (block.type === 'text') {
            currentStep.assistantText = block.text;
          } else if (block.type === 'tool-call') {
            let tool = currentStep.toolCalls.find(t => t.callId === block.id);
            if (!tool) {
              tool = {
                callId: block.id,
                name: block.name,
                arguments: block.arguments,
                status: 'running',
                startTime: ev.time || Date.now(),
              };
              currentStep.toolCalls.push(tool);
            }
          }
        }
      }
      if (data?.usage) {
        currentStep.usage = data.usage;
      }
      return;
    }

    // 6. Tool Call
    if (ev.type === 'tool/call') {
      const data = ev.data;
      if (data?.callId) {
        let tool = currentStep.toolCalls.find(t => t.callId === data.callId);
        if (!tool) {
          tool = {
            callId: data.callId,
            name: data.name || '',
            arguments: data.arguments || '',
            status: 'running',
            startTime: ev.time || Date.now(),
          };
          currentStep.toolCalls.push(tool);
        }
      }
      return;
    }

    // 7. Tool Result
    if (ev.type === 'tool/result') {
      const data = ev.data;
      const results = data?.message?.content || [];
      for (const res of results) {
        if (res.type === 'tool-result') {
          const callId = res.toolCallId;
          const tool = currentStep.toolCalls.find(t => t.callId === callId) ||
                       this.turns.flatMap(t => t.steps).flatMap(s => s.toolCalls).find(t => t.callId === callId);
          if (tool) {
            const textContent = res.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') || '';
            tool.result = textContent;
            tool.isError = res.isError === true;
            tool.status = res.isError ? 'error' : 'completed';
            tool.endTime = ev.time || Date.now();
          }
        }
      }
      return;
    }

    // 8. Todo Write
    if (ev.type === 'todo/write' && ev.data?.todos) {
      this.todos = ev.data.todos;
      return;
    }

    // 9. Turn End
    if (ev.type === 'turn/end') {
      const turn = this.ensureTurn(ev.data?.turn);
      turn.status = 'completed';
      for (const s of turn.steps) s.status = 'completed';
      if (this.turns[this.turns.length - 1] === turn) {
        this.isGenerating = false;
      }
      return;
    }
  }

  // User Actions
  public async sendPrompt(text: string, images: string[] = []) {
    if (!this.currentSessionId || (!text.trim() && images.length === 0)) return;

    const trimmed = text.trim();
    const tempId = `temp_${Date.now()}`;

    // 1. Calculate next turn number (lastTurn.turn + 1 or 1)
    const nextTurnNum = this.turns.length > 0 ? this.turns[this.turns.length - 1].turn + 1 : 1;

    // 2. OPTIMISTIC ECHO: Add turn with userMessage immediately
    const turn = this.ensureTurn(nextTurnNum);
    turn.userMessage = {
      id: tempId,
      text: trimmed,
      images,
      timestamp: Date.now(),
      status: 'sending',
    };
    turn.steps = [];
    turn.status = 'running';

    this.isGenerating = true;
    this.notify();

    // 3. HTTP POST prompt with exact schema { sessionId, mode, content }
    try {
      const content = [
        ...images.map(img => ({ type: 'image', mediaType: 'image/png', data: img })),
        ...(trimmed ? [{ type: 'text', text: trimmed }] : []),
      ];

      const res = await this.client.rpc<{ accepted?: boolean }>('session.prompt', {
        sessionId: this.currentSessionId,
        mode: 'queue',
        content,
      });

      if (res?.accepted !== true) {
        throw new Error('Prompt not accepted');
      }

      if (turn.userMessage) {
        turn.userMessage.status = 'sent';
        this.notify();
      }
    } catch (err: any) {
      console.error('[mobile-state] sendPrompt error:', err);
      if (turn.userMessage) {
        turn.userMessage.status = 'error';
        this.isGenerating = false;
        this.notify();
      }
    }
  }

  public async cancelGeneration() {
    if (!this.currentSessionId) return;
    try {
      await this.client.rpc('session.cancel', { sessionId: this.currentSessionId });
      this.isGenerating = false;
      this.notify();
    } catch (e) {
      console.error('[mobile-state] cancel error:', e);
    }
  }

  public async respondApproval(outcome: 'allowed-once' | 'rejected') {
    if (!this.pendingApproval) return;
    const { rpcId, approvalId, sessionId } = this.pendingApproval;
    this.pendingApproval = null;
    this.notify();

    if (rpcId) {
      await this.client.respond(rpcId, {
        sessionId,
        approvalId,
        outcome,
      });
    }
  }

  public async respondQuestion(answers: Array<{ id: string; selected?: string[]; custom?: string }>) {
    if (!this.pendingQuestion) return;
    const { rpcId, sessionId } = this.pendingQuestion;
    this.pendingQuestion = null;
    this.notify();

    if (rpcId) {
      await this.client.respond(rpcId, {
        sessionId,
        answer: answers,
      });
    }
  }

  public async loadSessionModels(sessionId: string) {
    try {
      const res = await this.client.rpc<{ current: any; groups: any[] }>('session.models', { sessionId });
      if (res && res.current) {
        this.currentModel = {
          provider: res.current.provider || 'antigravity',
          model: res.current.model || 'gemini-3.7-flash-high',
        };
        const allModels: ModelCatalogItem[] = [];
        for (const grp of res.groups || []) {
          for (const m of grp.models || []) {
            allModels.push({
              id: m.id,
              name: m.name || m.id,
              description: m.description,
              contextWindow: m.contextWindow,
            });
          }
        }
        this.models = allModels;
        this.notify();
      }
    } catch (e) {
      console.error('[mobile-state] loadModels error:', e);
    }
  }

  public async selectModel(modelId: string, provider = 'antigravity') {
    if (!this.currentSessionId) return;
    try {
      await this.client.rpc('session.selectModel', {
        sessionId: this.currentSessionId,
        provider,
        model: modelId,
      });
      this.currentModel = { provider, model: modelId };
      this.isModelPickerOpen = false;
      this.notify();
    } catch (e) {
      console.error('[mobile-state] selectModel error:', e);
    }
  }

  public async setPermissionPreset(preset: string) {
    this.currentPermission = preset;
    this.notify();
    await this.sendPrompt(`/permission ${preset}`);
  }

  public openToolInspector(tool: ToolExecution) {
    this.activeTool = tool;
    this.isToolInspectorOpen = true;
    this.notify();
  }

  public closeToolInspector() {
    this.isToolInspectorOpen = false;
    this.activeTool = null;
    this.notify();
  }

  public getCurrentSession(): SessionMetadata | null {
    if (!this.currentSessionId) return null;
    return this.sessions.find(s => s.sessionId === this.currentSessionId) || null;
  }
}

export const store = new StateStore();
