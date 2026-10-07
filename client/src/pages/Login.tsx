import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import { FieldError } from "@/components/common/Feedback";
import { Logo } from "@/components/common/Logo";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Whatever the API rejected the whole attempt with — wrong password, a
  // suspended account. It belongs to the form, not to any one field.
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  // Where to go after signing in. No route sets `from` today, so this is always
  // /dashboard; it is kept so a guard can pass a return path later.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  if (user) return <Navigate to={redirectTo} replace />;

  async function submit(values: LoginValues) {
    setFormError(null);
    try {
      await login(values.email.trim(), values.password);
      toast.success("Signed in. Welcome back.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // The password was right but the address was never confirmed. The backend
      // has already mailed a new code and set the pending cookie, so the only
      // thing left is to show the code screen.
      if (error instanceof ApiError && error.code === "email_unverified") {
        toast.info(error.message);
        navigate("/verify", {
          replace: true,
          state: { verification: error.data?.verification },
        });
        return;
      }
      setFormError((error as Error).message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card raised">
        <Logo />
        <h1>Sign in to your space.</h1>
        <p className="auth-lede">Use your official UIU account to continue where you left off.</p>

        <form onSubmit={handleSubmit(submit)} noValidate>
          <label className="field">
            <span>UIU email</span>
            <input
              className="recessed"
              type="email"
              autoComplete="email"
              placeholder="you@bscse.uiu.ac.bd"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="recessed"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </label>

          <FieldError message={formError} />

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"} <ArrowRight size={17} />
          </button>
        </form>

        <p className="auth-switch">
          New to UniFind? <Link to="/register">Create an account</Link>
        </p>

        <p className="auth-footnote mono-label">
          <Lock size={13} /> LISTINGS STAY PRIVATE UNTIL YOU ARE SIGNED IN
        </p>
      </div>
    </div>
  );
}
