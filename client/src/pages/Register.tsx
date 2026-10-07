import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { FieldError } from "@/components/common/Feedback";
import { Logo } from "@/components/common/Logo";
import { registerSchema, type RegisterValues } from "@/lib/schemas";

export function Register() {
  const { user, register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", department: "", password: "", confirm: "" },
  });

  // Already signed in — a session only exists once the email is confirmed.
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(values: RegisterValues) {
    setFormError(null);
    try {
      const created = await createAccount({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        department: values.department?.trim() || undefined,
      });
      // Which of the two the backend returned decides where to go next: a member
      // means registering signed them in, a verification means it did not.
      if (created.user) {
        toast.success(`Welcome to UniFind, ${created.user.name.split(" ")[0]}.`);
        navigate("/dashboard", { replace: true });
        return;
      }

      toast.success("Account created. Enter the code we emailed you to finish.");
      // The details ride along in router state to save a request; /verify can
      // also read them back from the pending cookie on a reload.
      navigate("/verify", { replace: true, state: { verification: created.verification } });
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card raised">
        <Logo />
        <h1>Join the network.</h1>
        <p className="auth-lede">
          UniFind is restricted to United International University. Register with the email your
          department issued you.
        </p>

        <form onSubmit={handleSubmit(submit)} noValidate>
          <label className="field">
            <span>Full name</span>
            <input
              className="recessed"
              autoComplete="name"
              placeholder="e.g. Ayesha Rahman"
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </label>

          <label className="field">
            <span>UIU email</span>
            <input
              className="recessed"
              type="email"
              autoComplete="email"
              placeholder="you@bscse.uiu.ac.bd"
              {...register("email")}
            />
            <p className="field-hint">
              Any UIU department address works — bscse, eee, bba, and the rest.
            </p>
            <FieldError message={errors.email?.message} />
          </label>

          <label className="field">
            <span>
              Department <em>optional</em>
            </span>
            <input
              className="recessed"
              placeholder="e.g. Computer Science & Engineering"
              {...register("department")}
            />
            <FieldError message={errors.department?.message} />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Password</span>
              <input
                className="recessed"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </label>

            <label className="field">
              <span>Confirm password</span>
              <input
                className="recessed"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                {...register("confirm")}
              />
              <FieldError message={errors.confirm?.message} />
            </label>
          </div>

          <FieldError message={formError} />

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"} <ArrowRight size={17} />
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>

        <p className="auth-footnote mono-label">
          <Lock size={13} /> PASSWORDS ARE HASHED — NEVER STORED AS TEXT
        </p>
      </div>
    </div>
  );
}
