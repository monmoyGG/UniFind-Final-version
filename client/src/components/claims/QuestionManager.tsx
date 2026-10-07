import { useState } from "react";
import { toast } from "sonner";
import { ListChecks, Plus, Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { claimService } from "@/services/claimService";
import type { ClaimQuestionDraft } from "@/types";

/** Poster/admin editor for the hidden ownership quiz on one item. */
export function QuestionManagerModal({
  itemId,
  onClose,
}: {
  itemId: number;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<ClaimQuestionDraft[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    claimService
      .manageQuestions(itemId)
      .then(data => {
        setQuestions(data.questions);
        setLocked(data.locked);
      })
      .catch((loadError: Error) => {
        toast.error(loadError.message);
        onClose();
      });
  }

  function update(index: number, next: Partial<ClaimQuestionDraft>) {
    setQuestions(current =>
      (current ?? []).map((question, position) =>
        position === index ? { ...question, ...next } : question
      )
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions(current =>
      (current ?? []).map((question, position) => {
        if (position !== questionIndex) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      })
    );
  }

  async function save() {
    if (!questions) return;
    setSaving(true);
    try {
      const cleaned = questions.map(question => ({
        prompt: question.prompt.trim(),
        options: question.options.map(option => option.trim()),
        correct_option: question.correct_option,
      }));
      const data = await claimService.saveQuestions(itemId, cleaned);
      setQuestions(data.questions);
      toast.success("Verification questions saved.");
      onClose();
    } catch (saveError) {
      toast.error((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Ownership quiz"
      description="Claimants must answer these; only you see the score."
      onClose={onClose}
    >
      {locked ? (
        <p className="panel-note">
          Questions are locked because a claim already exists or the case is resolved.
        </p>
      ) : !questions ? (
        <p className="panel-note">Loading…</p>
      ) : (
        <div className="quiz-editor">
          {questions.length === 0 && (
            <p className="panel-note">
              No questions yet. Add one or two that only the real owner could answer.
            </p>
          )}
          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="quiz-editor-block recessed">
              <div className="quiz-editor-head">
                <span className="mono-label">QUESTION {questionIndex + 1}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm danger"
                  onClick={() =>
                    setQuestions(current =>
                      (current ?? []).filter((_, position) => position !== questionIndex)
                    )
                  }
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
              <input
                className="recessed"
                value={question.prompt}
                maxLength={300}
                placeholder="e.g. What is engraved on the back?"
                onChange={event => update(questionIndex, { prompt: event.target.value })}
              />
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="quiz-option-row">
                  <input
                    type="radio"
                    name={`correct-${questionIndex}`}
                    checked={question.correct_option === optionIndex}
                    onChange={() => update(questionIndex, { correct_option: optionIndex })}
                    aria-label="Mark this option as correct"
                  />
                  <input
                    className="recessed"
                    value={option}
                    maxLength={200}
                    placeholder={`Option ${optionIndex + 1}`}
                    onChange={event => updateOption(questionIndex, optionIndex, event.target.value)}
                  />
                </label>
              ))}
              {question.options.length < 4 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    update(questionIndex, { options: [...question.options, ""] })
                  }
                >
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>
          ))}

          <div className="quiz-editor-actions">
            {questions.length < 5 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setQuestions(current => [...(current ?? []), { prompt: "", options: ["", ""], correct_option: 0 }])
                }
              >
                <Plus size={14} /> Add question
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving || questions.some(question => !question.prompt.trim() || question.options.some(option => !option.trim()))}
              onClick={save}
            >
              <Save size={14} /> {saving ? "Saving…" : "Save questions"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function QuestionManagerButton({ itemId }: { itemId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <ListChecks size={16} /> Ownership quiz
      </button>
      {open && <QuestionManagerModal itemId={itemId} onClose={() => setOpen(false)} />}
    </>
  );
}
