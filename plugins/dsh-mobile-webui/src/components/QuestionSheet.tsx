import { h, VNode } from 'preact';
import { useState } from 'preact/hooks';
import { UserQuestionRequest } from '../store/types';
import { SparklesIcon } from './Icons';

export function QuestionSheet({
  questionReq,
  onAnswer,
}: {
  questionReq: UserQuestionRequest | null;
  onAnswer: (answers: Array<{ id: string; selected?: string[]; custom?: string }>) => void;
}): VNode | null {
  if (!questionReq || !questionReq.questions || questionReq.questions.length === 0) return null;

  const [answers, setAnswers] = useState<Record<string, { selected: string[]; custom: string }>>({});

  const toggleOption = (qId: string, label: string, isMulti = false) => {
    const current = answers[qId] || { selected: [], custom: '' };
    let nextSelected: string[];
    if (isMulti) {
      nextSelected = current.selected.includes(label)
        ? current.selected.filter(l => l !== label)
        : [...current.selected, label];
    } else {
      nextSelected = [label];
    }
    setAnswers({
      ...answers,
      [qId]: { ...current, selected: nextSelected },
    });
  };

  const setCustomText = (qId: string, text: string) => {
    const current = answers[qId] || { selected: [], custom: '' };
    setAnswers({
      ...answers,
      [qId]: { ...current, custom: text },
    });
  };

  const handleSubmit = () => {
    const payload = questionReq.questions.map(q => {
      const a = answers[q.id] || { selected: [], custom: '' };
      return {
        id: q.id,
        ...(a.selected.length > 0 ? { selected: a.selected } : {}),
        ...(a.custom.trim() ? { custom: a.custom.trim() } : {}),
      };
    });
    onAnswer(payload);
  };

  return (
    <div class="sheet-backdrop">
      <div class="sheet-card">
        <div class="sheet-handle-bar">
          <div class="sheet-handle"></div>
        </div>

        <div class="sheet-header">
          <div class="flex items-center gap-2" style="color: var(--accent-primary);">
            <SparklesIcon size={20} />
            <span class="sheet-title">智能体需要您的确认</span>
          </div>
        </div>

        <div class="sheet-content">
          {questionReq.questions.map((q, idx) => {
            const current = answers[q.id] || { selected: [], custom: '' };
            return (
              <div key={q.id || idx} style="margin-bottom: 18px;">
                {q.header && (
                  <div style="font-size: 13px; font-weight: 600; color: var(--accent-primary); margin-bottom: 4px;">
                    {q.header}
                  </div>
                )}
                <div style="font-size: 15px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">
                  {q.question}
                </div>
                {q.detail && (
                  <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">
                    {q.detail}
                  </div>
                )}

                {/* Options List */}
                {q.options && q.options.length > 0 && (
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = current.selected.includes(opt.label);
                      return (
                        <div
                          key={optIdx}
                          onClick={() => toggleOption(q.id, opt.label, q.multiSelect)}
                          style={`padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}; background: ${isSelected ? 'var(--accent-glass)' : 'var(--bg-tertiary)'}; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: all 0.15s;`}
                        >
                          <div style="font-size: 14px; font-weight: 500; color: var(--text-primary);">
                            {opt.label}
                          </div>
                          {opt.description && (
                            <div style="font-size: 12px; color: var(--text-muted);">
                              {opt.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Custom text input */}
                <input
                  type="text"
                  placeholder="或输入自定义回复..."
                  value={current.custom}
                  onInput={(e: any) => setCustomText(q.id, e.target.value)}
                  style="width: 100%; height: 38px; padding: 0 12px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary); font-size: 14px; outline: none;"
                />
              </div>
            );
          })}

          <button
            style="width: 100%; height: 44px; margin-top: 10px; border-radius: var(--radius-md); border: none; background: var(--accent-primary); color: #ffffff; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);"
            onClick={handleSubmit}
          >
            提交回复
          </button>
        </div>
      </div>
    </div>
  );
}
