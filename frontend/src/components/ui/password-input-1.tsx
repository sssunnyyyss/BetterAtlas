import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";

const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, text: "At least 8 characters" },
  { regex: /[0-9]/, text: "At least 1 number" },
  { regex: /[a-z]/, text: "At least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
  { regex: /[!-\/:-@[-`{-~]/, text: "At least 1 special characters" },
] as const;

type StrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

const STRENGTH_CONFIG = {
  colors: {
    0: "bg-border",
    1: "bg-red-500",
    2: "bg-orange-500",
    3: "bg-amber-500",
    4: "bg-amber-700",
    5: "bg-emerald-500",
  } satisfies Record<StrengthScore, string>,
  texts: {
    0: "Enter a password",
    1: "Weak password",
    2: "Medium password!",
    3: "Strong password!!",
    4: "Very Strong password!!!",
  } satisfies Record<Exclude<StrengthScore, 5>, string>,
} as const;

type Requirement = {
  met: boolean;
  text: string;
};

export type PasswordStrength = {
  score: StrengthScore;
  requirements: Requirement[];
};

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements = PASSWORD_REQUIREMENTS.map((req) => ({
    met: req.regex.test(password),
    text: req.text,
  }));

  return {
    score: requirements.filter((req) => req.met).length as StrengthScore,
    requirements,
  };
}

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minAcceptedScore?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const PasswordInput = ({
  id = "password",
  name = "password",
  value,
  onChange,
  label = "Password",
  placeholder = "Password",
  required = false,
  minAcceptedScore = 4,
  className = "",
}: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const calculateStrength = useMemo(() => getPasswordStrength(value), [value]);

  return (
    <div className={`w-full ${className}`}>
      <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            name={name}
            type={isVisible ? "text" : "password"}
            value={value}
            required={required}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={calculateStrength.score < minAcceptedScore}
            aria-describedby={`${id}-strength`}
            className="w-full rounded-md border-2 bg-background p-2 outline-none transition focus-within:border-blue-700"
          />
          <button
            type="button"
            onClick={() => setIsVisible((prev) => !prev)}
            aria-label={isVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground/80"
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div
        className="mb-4 mt-3 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={calculateStrength.score}
        aria-valuemin={0}
        aria-valuemax={5}
      >
        <div
          className={`h-full ${STRENGTH_CONFIG.colors[calculateStrength.score]} transition-all duration-500`}
          style={{ width: `${(calculateStrength.score / 5) * 100}%` }}
        />
      </div>

      <p id={`${id}-strength`} className="mb-2 flex justify-between text-sm font-medium">
        <span>Must contain:</span>
        <span>
          {
            STRENGTH_CONFIG.texts[
              Math.min(calculateStrength.score, 4) as keyof typeof STRENGTH_CONFIG.texts
            ]
          }
        </span>
      </p>

      <ul className="space-y-1.5" aria-label="Password requirements">
        {calculateStrength.requirements.map((req, index) => (
          <li key={index} className="flex items-center space-x-2">
            {req.met ? (
              <Check size={16} className="text-emerald-500" />
            ) : (
              <X size={16} className="text-muted-foreground/80" />
            )}
            <span className={`text-xs ${req.met ? "text-emerald-600" : "text-muted-foreground"}`}>
              {req.text}
              <span className="sr-only">
                {req.met ? " - Requirement met" : " - Requirement not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordInput;
