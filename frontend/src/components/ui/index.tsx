import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
  leftSection?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  loading = false,
  leftSection,
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
      ? "btn-secondary"
      : "btn-outline";
  const sizeClass =
    size === "xs"
      ? "px-2 py-1 text-xs"
      : size === "sm"
      ? "px-3 py-1.5 text-sm"
      : size === "lg"
      ? "px-6 py-3 text-lg"
      : "px-4 py-2";
  return (
    <button
      className={`${baseClass} ${sizeClass} ${className} ${
        disabled || loading ? "opacity-50 cursor-not-allowed" : ""
      } inline-flex items-center justify-center gap-2`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-5 w-5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {leftSection && <span className="flex-shrink-0">{leftSection}</span>}
      {children}
    </button>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export function TextInput({
  label,
  description,
  error,
  className = "",
  ...props
}: TextInputProps) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium mb-2">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        className={`input w-full ${error ? "border-red-500" : ""} ${className}`}
        {...props}
      />
      {description && (
        <p className="text-sm text-neutral-400 mt-1">{description}</p>
      )}
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
}

interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export function PasswordInput({
  label,
  description,
  error,
  className = "",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium mb-2">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className={`input w-full pr-10 ${
            error ? "border-red-500" : ""
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {showPassword ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      </div>
      {description && (
        <p className="text-sm text-neutral-400 mt-1">{description}</p>
      )}
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
}

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className="flex items-center cursor-pointer group">
      <input
        type="checkbox"
        className={`w-5 h-5 flex-shrink-0 rounded border-neutral-600 bg-neutral-800 text-primary focus:ring-2 focus:ring-primary focus:ring-opacity-50 transition-all ${className}`}
        {...props}
      />
      {label && (
        <span className="ml-3 text-neutral-200 group-hover:text-neutral-100 transition-colors leading-5">
          {label}
        </span>
      )}
    </label>
  );
}

interface AlertProps {
  children: React.ReactNode;
  variant?: "info" | "error" | "success" | "warning";
  icon?: React.ReactNode;
  className?: string;
}

export function Alert({
  children,
  variant = "info",
  icon,
  className = "",
}: AlertProps) {
  const variantClass =
    variant === "error"
      ? "alert-error"
      : variant === "success"
      ? "alert-success"
      : variant === "warning"
      ? "bg-yellow-900/20 border-yellow-700/30 text-yellow-200"
      : "alert-info";

  return (
    <div className={`alert ${variantClass} ${className}`}>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface PaperProps {
  children: React.ReactNode;
  className?: string;
}

export function Paper({ children, className = "" }: PaperProps) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-lg p-6 ${className}`}
    >
      {children}
    </div>
  );
}

interface CodeProps {
  children: React.ReactNode;
  block?: boolean;
}

export function Code({ children, block = false }: CodeProps) {
  if (block) {
    return (
      <pre className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 overflow-x-auto mb-4">
        <code className="text-sm font-mono text-neutral-200">{children}</code>
      </pre>
    );
  }
  return (
    <code className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200">
      {children}
    </code>
  );
}

interface AnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
}

export function Anchor({ children, className = "", ...props }: AnchorProps) {
  return (
    <a
      className={`text-primary hover:text-primary/80 underline transition-colors ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
