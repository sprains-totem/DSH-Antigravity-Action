import { h, VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { store } from './store/state';
import { Header } from './components/Header';
import { TrajectoryTimeline } from './components/TrajectoryTimeline';
import { Composer } from './components/Composer';
import { SessionDrawer } from './components/SessionDrawer';
import { ToolBottomSheet } from './components/ToolBottomSheet';
import { ApprovalSheet } from './components/ApprovalSheet';
import { QuestionSheet } from './components/QuestionSheet';
import { TodoPlanView } from './components/TodoPlanView';
import { ModelPickerSheet } from './components/ModelPickerSheet';

export function App(): VNode {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTick(t => t + 1);
    });
    store.init();
    return unsub;
  }, []);

  const activeSession = store.getCurrentSession();
  const title = activeSession?.title || 'DeepSeek Harness';

  return (
    <div id="app">
      {/* 1. App Header */}
      <Header
        title={title}
        todosCount={store.todos.filter(t => t.status !== 'completed').length}
        modelName={store.currentModel.model}
        connectionState={store.connectionState}
        onOpenDrawer={() => { store.isDrawerOpen = true; store.subscribe(() => {})(); setTick(t => t + 1); }}
        onNewChat={() => store.createSession()}
        onOpenModelPicker={() => { store.isModelPickerOpen = true; setTick(t => t + 1); }}
        onOpenTodos={() => { store.isTodoDrawerOpen = true; setTick(t => t + 1); }}
      />

      {/* 2. Trajectory Timeline & Chat View */}
      <TrajectoryTimeline
        turns={store.turns}
        onToolClick={(tool) => store.openToolInspector(tool)}
      />

      {/* 3. Bottom Composer */}
      <Composer
        isGenerating={store.isGenerating}
        currentPermission={store.currentPermission}
        onSend={(text, images) => store.sendPrompt(text, images)}
        onCancel={() => store.cancelGeneration()}
        onOpenModelPicker={() => { store.isModelPickerOpen = true; setTick(t => t + 1); }}
      />

      {/* 4. Left Session Navigation Drawer */}
      <SessionDrawer
        isOpen={store.isDrawerOpen}
        sessions={store.sessions}
        currentSessionId={store.currentSessionId}
        onSelectSession={(id) => store.selectSession(id)}
        onNewChat={() => store.createSession()}
        onDeleteSession={(id) => store.deleteSession(id)}
        onClose={() => { store.isDrawerOpen = false; setTick(t => t + 1); }}
      />

      {/* 5. Tool Call Detail Inspector Bottom Sheet */}
      <ToolBottomSheet
        tool={store.isToolInspectorOpen ? store.activeTool : null}
        onClose={() => store.closeToolInspector()}
      />

      {/* 6. Human-in-the-Loop Permission Approval Sheet */}
      <ApprovalSheet
        approval={store.pendingApproval}
        onRespond={(outcome) => store.respondApproval(outcome)}
      />

      {/* 7. Agent User Question Choice Sheet */}
      <QuestionSheet
        questionReq={store.pendingQuestion}
        onAnswer={(answers) => store.respondQuestion(answers)}
      />

      {/* 8. Plan Mode / Todo Checklist View */}
      <TodoPlanView
        isOpen={store.isTodoDrawerOpen}
        goal={store.goal}
        todos={store.todos}
        onClose={() => { store.isTodoDrawerOpen = false; setTick(t => t + 1); }}
      />

      {/* 9. Model & Permission Picker Sheet */}
      <ModelPickerSheet
        isOpen={store.isModelPickerOpen}
        models={store.models}
        currentModel={store.currentModel}
        currentPermission={store.currentPermission}
        onSelectModel={(mId, prov) => store.selectModel(mId, prov)}
        onSelectPermission={(pId) => store.setPermissionPreset(pId)}
        onClose={() => { store.isModelPickerOpen = false; setTick(t => t + 1); }}
      />
    </div>
  );
}
