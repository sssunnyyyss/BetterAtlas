import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface OTPInputProps {
  title?: string;
  description?: string;
  codeLength?: number;
  value?: string;
  onChange?: (code: string) => void;
  onVerify?: (code: string) => void | Promise<void>;
  onResend?: () => void | Promise<void>;
  verifyDisabled?: boolean;
  verifyLabel?: string;
  isVerifying?: boolean;
}

const OTPInput = ({
  title = "Enter Verification Code",
  description = "We've sent a 6-digit code to your email",
  codeLength = 6,
  value,
  onChange,
  onVerify,
  onResend,
  verifyDisabled = false,
  verifyLabel = "Verify Code",
  isVerifying = false,
}: OTPInputProps) => {
  const [otp, setOtp] = useState<string[]>(Array(codeLength).fill(""));
  const [isPasted, setIsPasted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (typeof value !== "string") return;
    const digits = value.replace(/\D/g, "").slice(0, codeLength).split("");
    const next = Array(codeLength).fill("");
    for (let i = 0; i < digits.length; i += 1) next[i] = digits[i] ?? "";
    setOtp(next);
  }, [value, codeLength]);

  useEffect(() => {
    const allFilled = otp.every((digit) => digit !== "");
    setIsComplete(allFilled);
    onChange?.(otp.join(""));
  }, [otp, onChange]);

  const handleChange = (index: number, raw: string) => {
    if (raw.length > 1) return;
    if (raw && !/^\d$/.test(raw)) return;

    const next = [...otp];
    next[index] = raw;
    setOtp(next);
    setIsPasted(false);

    if (raw && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeLength);
    if (!pasted) return;

    const next = Array(codeLength).fill("");
    for (let i = 0; i < Math.min(pasted.length, codeLength); i += 1) {
      next[i] = pasted[i] ?? "";
    }
    setOtp(next);
    setIsPasted(true);

    const nextEmptyIndex = next.findIndex((digit) => digit === "");
    const focusIndex = nextEmptyIndex === -1 ? codeLength - 1 : nextEmptyIndex;
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
  };

  const clearOtp = () => {
    setOtp(Array(codeLength).fill(""));
    setIsPasted(false);
    setIsComplete(false);
    inputRefs.current[0]?.focus();
  };

  const copyOtp = async () => {
    const code = otp.join("");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // no-op
    }
  };

  const code = otp.join("");
  const canVerify = isComplete && !verifyDisabled && !isVerifying;

  return (
    <div className="w-full rounded-2xl bg-gray-50 p-4 text-gray-900 transition-colors duration-200">
      <div className="w-full">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-colors duration-200">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-2xl font-bold">{title}</h2>
            <p className="text-sm text-gray-600">{description}</p>
          </div>

          <div className="mb-6 flex justify-center gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`h-14 w-12 rounded-lg border-2 text-center text-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isPasted
                    ? "bg-green-50 border-green-400 text-green-800"
                    : isComplete
                      ? "bg-blue-50 border-blue-400 text-blue-800"
                      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                } focus:ring-offset-white`}
                maxLength={1}
                autoComplete="off"
              />
            ))}
          </div>

          {isPasted && (
            <div className="mb-4 text-center">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  "bg-green-100 text-green-700"
                }`}
              >
                <Check size={14} />
                Code pasted successfully
              </span>
            </div>
          )}

          {isComplete && (
            <div className="mb-4 text-center">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  "bg-blue-100 text-blue-700"
                }`}
              >
                <Check size={14} />
                Code complete: {code}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onVerify?.(code)}
              disabled={!canVerify}
              className={`w-full rounded-lg px-4 py-3 font-medium transition-all duration-200 ${
                canVerify
                  ? "bg-blue-500 text-white shadow-md hover:scale-[1.02] hover:bg-blue-600"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              {isVerifying ? "Verifying..." : verifyLabel}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearOtp}
                className="flex-1 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200"
              >
                Clear
              </button>
              {isComplete && (
                <button
                  type="button"
                  onClick={copyOtp}
                  className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-200"
                  title="Copy OTP"
                >
                  <Copy size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Didn't receive the code?{" "}
              <button
                type="button"
                onClick={() => onResend?.()}
                className="font-medium text-blue-600 transition-colors hover:text-blue-500"
              >
                Resend
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPInput;
