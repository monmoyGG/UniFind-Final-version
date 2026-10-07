import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useApi } from "@/hooks/useApi";
import { claimService } from "@/services/claimService";
import type { ClaimAnswer } from "@/types";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { FieldError } from "@/components/common/Feedback";
import { claimSchema, type ClaimValues } from "@/lib/schemas";

/**
 * Ownership claim dialog.
 *
 * The verification message is the whole point: it's how a claimant shows they
 * know something about the item that isn't in the public listing. The poster's
 * hidden multiple-choice questions are answered here too; their score goes to
 * the poster with the claim, never back to the claimant.
 */
export function ClaimModal({
  itemId,
  itemTitle,
  submitting,
  onSubmit,
  onClose,
}: {
  itemId: number;
  itemTitle: string;
  submitting: boolean;
  onSubmit: (message: string, answers: ClaimAnswer[]) => Promise<void>;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClaimValues>({
    resolver: zodResolver(claimSchema),
    mode: "onTouched",
    defaultValues: { message: "" },
  });

  const {
    data: questions,
    loading: questionsLoading,
    error: questionsError,
  } = useApi(signal => claimService.questions(itemId, signal), [itemId]);

  const busy = submitting || isSubmitting;

  function submit(values: ClaimValues) {
    const payload: ClaimAnswer[] = (questions ?? []).map(question => ({
      question_id: question.id,
      selected_option: answers[question.id] ?? -1,
    }));
    return onSubmit(values.message.trim(), payload);
  }

  const allAnswered = (questions ?? []).every(question => answers[question.id] !== undefined);

  return (
    <Modal title="Claim this item" description={`Regarding: ${itemTitle}`} onClose={onClose}>
      {/* A real <form> so Enter submits and the browser treats it as one unit;
          the dialog's only actions row stays where it was. */}
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="claim-hint recessed">
          <ShieldCheck size={18} />
          <p>
            Describe a detail only the owner would know — a mark, what's inside, or where you last
            had it. The poster reviews this before approving anything.
          </p>
        </div>

        <label className="field">
          <span>Verification message</span>
          <textarea
            className="recessed"
            rows={5}
            maxLength={2000}
            placeholder="e.g. My wallet has a small silver logo inside and contains my UIU ID."
            {...register("message")}
          />
          <FieldError message={errors.message?.message} />
        </label>

        {questionsLoading && <p className="panel-note">Loading verification questions…</p>}
        {questionsError && (
          <p className="panel-note">Could not load verification questions. Submit anyway.</p>
        )}
        {questions && questions.length > 0 && (
          <div className="claim-questions recessed">
            <p className="mono-label accent">OWNERSHIP QUIZ — {questions.length} QUESTION{questions.length === 1 ? "" : "S"}</p>
            {questions.map(question => (
              <fieldset key={question.id} className="claim-question">
                <legend>{question.prompt}</legend>
                {question.options.map((option, index) => (
                  <label key={index} className="claim-option">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id] === index}
                      onChange={() => setAnswers(current => ({ ...current, [question.id]: index }))}
                      disabled={busy}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <p className="panel-note">
              The poster sees your score with the claim. Answer honestly — a wrong pick does not
              block you, but it is visible.
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || (questions !== null && !allAnswered)}>
            {busy ? "Submitting…" : "Submit claim"}
          </button>
          {(questions ?? []).length > 0 && !allAnswered && (
            <p className="claim-quiz-note mono-label">ANSWER EVERY QUESTION TO CONTINUE</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
