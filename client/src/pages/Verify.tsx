import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { FieldError, LoadingSpinner } from "@/components/common/Feedback";
import { Logo } from "@/components/common/Logo";
import { authService } from "@/services/authService";
import type { Verification } from "@/types";

const CODE_LENGTH = 6;

/** Matches RESEND_COOLDOWN_SECONDS in backend/auth.py. */
const RESEND_COOLDOWN = 60;

/** Matches CODE_TTL_MINUTES in backend/auth.py, used only until the real value loads. */
const CODE_TTL_MINUTES = 10;

/**
 * Email confirmation.
 *
 * This screen is the gate, not a reminder. Registering creates the account but
 * hands out no session — the member is not signed in while they are here, and
 * entering the correct code is what both confirms the address and signs them
 * in. Everything on this page therefore runs off the pending cookie, which the
 * backend accepts for exactly two endpoints: /verify and /resend.
 */
export function Verify() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Register and Login hand the details over in router state, so the usual
  // arrival needs no extra request. A reload has no state, and falls back to
  // asking the server who the pending cookie names.
  const handoff = (location.state as { verification?: Verification } | null)?.verification;

  const [email, setEmail] = useState<string | null>(handoff?.email ?? null);
  const [expiresIn, setExpiresIn] = useState(handoff?.expires_in_minutes ?? CODE_TTL_MINUTES);
  const [checking, setChecking] = useState(!handoff);
  /** True once the pending cookie is gone or expired — there is nothing to confirm. */
  const [lapsed, setLapsed] = useState(false);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(handoff ? RESEND_COOLDOWN : 0);
  const [devCode, setDevCode] = useState<string | null>(handoff?.dev_code ?? null);
  const [delivered, setDelivered] = useState<boolean>(handoff?.sent ?? true);

  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Recover the pending account after a reload, when router state is gone.
  useEffect(() => {
    if (handoff) return;
    let cancelled = false;
    authService
      .pending()
      .then(pending => {
        if (cancelled) return;
        setEmail(pending.email);
        setExpiresIn(pending.expires_in_minutes);
      })
      .catch(() => {
        if (!cancelled) setLapsed(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handoff]);

  useEffect(() => {
    if (!checking) inputs.current[0]?.focus();
  }, [checking]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Confirming is what signs the member in, so a session here means it is done.
  if (user) return <Navigate to="/dashboard" replace />;

  if (checking) return <LoadingSpinner label="Looking up your confirmation…" />;

  // No pending registration: nothing on this page would work, and signing in
  // issues a fresh code for anyone whose address is still unconfirmed.
  if (lapsed || !email) return <Navigate to="/login" replace />;

  async function submitCode(code: string) {
    setSubmitting(true);
    setError(undefined);
    try {
      const { message } = await authService.verify(code);
      // The session cookie arrived with that response — this is what picks it up.
      await refresh();
      toast.success(message);
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError((caught as Error).message);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();

    // Submitting on the last digit saves a click; people expect it here.
    const code = next.join("");
    if (code.length === CODE_LENGTH && !next.includes("")) void submitCode(code);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  /** Spread a pasted code across the boxes — everyone pastes from their mail app. */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();

    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();

    if (pasted.length === CODE_LENGTH) void submitCode(pasted);
  }

  async function handleResend() {
    setError(undefined);
    try {
      const result = await authService.resend();
      setDevCode(result.dev_code);
      setDelivered(result.sent);
      setCooldown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
      if (result.sent) toast.success(`A new code is on its way to ${result.email}.`);
      else if (result.dev_code) toast.success("A new code was generated.");
      // Neither sent nor shown: the production backend refuses this with a 503,
      // so reaching here at all would mean something is genuinely wrong.
      else toast.error("We could not send that code. Please try again shortly.");
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card raised">
        <Logo />
        <p className="mono-label accent">CONFIRM YOUR UIU EMAIL</p>
        <h1>Check your inbox.</h1>
        <p className="auth-lede">
          We sent a six-digit code to <strong>{email}</strong>. Entering it confirms the address
          and signs you in — your account is not usable until then.
        </p>

        {/* The code itself only ever comes back from a development backend. */}
        {devCode && (
          <div className="verify-devnote recessed">
            <p className="mono-label">NO MAIL SERVER CONFIGURED</p>
            <p>
              This backend has no SMTP host set, so the code was printed to its console instead of
              being emailed. For this development build it is <code>{devCode}</code>.
            </p>
          </div>
        )}

        {/* Undelivered with no code to show means a real member is stuck, so say
            that plainly rather than leaking anything about the configuration. */}
        {!delivered && !devCode && (
          <div className="verify-devnote recessed">
            <p className="mono-label">THE EMAIL DID NOT GO OUT</p>
            <p>
              We could not deliver your code just now. Try <strong>Send another code</strong> in a
              moment, and let the UniFind administrators know if it keeps failing.
            </p>
          </div>
        )}

        <div className="verify-code" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={element => {
                inputs.current[index] = element;
              }}
              className="recessed"
              value={digit}
              onChange={event => handleChange(index, event.target.value)}
              onKeyDown={event => handleKeyDown(index, event)}
              disabled={submitting}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
              maxLength={1}
            />
          ))}
        </div>

        <FieldError message={error} />

        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={submitting || digits.includes("")}
          onClick={() => void submitCode(digits.join(""))}
        >
          {submitting ? "Confirming…" : "Confirm and sign in"} <CheckCircle2 size={17} />
        </button>

        <button
          type="button"
          className="text-button verify-resend"
          onClick={() => void handleResend()}
          disabled={cooldown > 0}
        >
          <RefreshCw size={14} />
          {cooldown > 0 ? `Send another code in ${cooldown}s` : "Send another code"}
        </button>

        <p className="auth-switch">
          Wrong address? <Link to="/register">Register again</Link>
        </p>

        <p className="auth-footnote mono-label">
          <Mail size={13} /> CODES EXPIRE AFTER {expiresIn} MINUTES
        </p>
      </div>
    </div>
  );
}
