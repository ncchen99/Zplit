import { useState, useEffect, useRef, useCallback } from "react";
import { BackspaceIcon } from "@heroicons/react/24/outline";

interface CalculatorInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function liveEval(expr: string): string {
  if (!expr) return "0";
  const trimmed = expr.replace(/[+\-×÷]$/, "");
  if (!trimmed) return "0";
  try {
    const sanitized = trimmed.replace(/×/g, "*").replace(/÷/g, "/");
    if (!/^[0-9+\-*/.]+$/.test(sanitized)) return trimmed;
    // eslint-disable-next-line no-new-func
    const result = new Function("return (" + sanitized + ")")() as unknown;
    if (typeof result !== "number" || !isFinite(result) || result < 0) {
      return trimmed;
    }
    return result === Math.floor(result)
      ? String(result)
      : String(Math.round(result * 100) / 100);
  } catch {
    return trimmed;
  }
}

function isOpChar(c: string) {
  return ["+", "-", "×", "÷"].includes(c);
}

interface CalcKeyProps {
  label: string;
  onClick: () => void;
  className?: string;
}

function CalcKey({ label, onClick, className = "" }: CalcKeyProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-11 items-center justify-center rounded-xl text-base font-medium select-none active:opacity-60 touch-manipulation ${className}`}
    >
      {label}
    </button>
  );
}

export function CalculatorInput({
  value,
  onChange,
  placeholder = "0",
}: CalculatorInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expression, setExpression] = useState("");
  const justOpenedRef = useRef(false);

  const openCalculator = useCallback(() => {
    setExpression(value || "");
    justOpenedRef.current = !!value;
    setIsOpen(true);
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [isOpen]);

  const hasOp = /[+\-×÷]/.test(expression);
  const displayTop = hasOp ? expression : "";
  const displayBottom = expression ? liveEval(expression) : "0";

  const handleNum = useCallback((n: string) => {
    if (justOpenedRef.current) {
      justOpenedRef.current = false;
      setExpression(n);
      return;
    }
    setExpression((prev) => (prev === "0" && n !== "." ? n : prev + n));
  }, []);

  const handleOp = useCallback((op: string) => {
    justOpenedRef.current = false;
    setExpression((prev) => {
      if (!prev) return prev;
      if (isOpChar(prev.slice(-1))) return prev.slice(0, -1) + op;
      return prev + op;
    });
  }, []);

  const handleDot = useCallback(() => {
    justOpenedRef.current = false;
    setExpression((prev) => {
      const parts = prev.split(/[+\-×÷]/);
      const last = parts[parts.length - 1];
      if (last.includes(".")) return prev;
      return prev + (last ? "." : "0.");
    });
  }, []);

  const handleBackspace = useCallback(() => {
    justOpenedRef.current = false;
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    justOpenedRef.current = false;
    setExpression("");
  }, []);

  const commitResult = useCallback(
    (expr: string) => {
      const trimmed = expr.replace(/[+\-×÷]$/, "");
      if (!trimmed) return;
      const result = liveEval(trimmed);
      const num = Math.round(Number(result));
      if (!isNaN(num) && num > 0) onChange(String(num));
    },
    [onChange],
  );

  const handleEquals = useCallback(() => {
    commitResult(expression);
    setIsOpen(false);
  }, [expression, commitResult]);

  const handleClose = useCallback(() => {
    commitResult(expression);
    setIsOpen(false);
  }, [expression, commitResult]);

  const numKeyCls = "btn-muted";
  const opKeyCls = "btn-muted";

  return (
    <>
      {/* Trigger field */}
      <div
        className="input flex items-center gap-2 w-full cursor-pointer"
        onClick={openCalculator}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openCalculator();
          }
        }}
      >
        <span className="text-base-content/50 font-semibold">NT$</span>
        <span className={`grow text-sm ${!value ? "text-base-content/40" : ""}`}>
          {value || placeholder}
        </span>
      </div>

      {/* Bottom sheet overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
            onClick={handleClose}
          />

          {/* Calculator card */}
          <div
            className={`relative bg-base-100 rounded-2xl shadow-2xl transition-transform duration-200 ease-out mx-3 mb-3 ${visible ? "translate-y-0" : "translate-y-full"}`}
          >
            {/* Display */}
            <div className="bg-base-200 rounded-t-2xl px-4 pt-3 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs text-right text-base-content/50 truncate h-4 leading-4">
                    {displayTop || "\u00a0"}
                  </p>
                  <div className="border-t border-base-content/10 my-1" />
                  <p className="text-3xl text-right text-base-content font-light truncate">
                    {displayBottom}
                  </p>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBackspace}
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-base-200 active:opacity-50 transition-opacity"
                >
                  <BackspaceIcon className="h-5 w-5 text-base-content/60" />
                </button>
              </div>
            </div>

            {/* Keypad
                Layout (5 cols × 4 rows):
                [ 7 ][ 8 ][ 9 ][ ÷ ][AC ]
                [ 4 ][ 5 ][ 6 ][ × ][ = ]  ← = spans rows 2-4 at col-5
                [ 1 ][ 2 ][ 3 ][ - ][   ]
                [ 0      ][ . ][ + ][   ]  ← 0 spans cols 1-2
            */}
            <div
              className="grid grid-cols-5 grid-rows-4 gap-1.5 p-2.5 bg-base-200/50 rounded-b-2xl"
              style={{
                paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
              }}
            >
              {/* Row 1 */}
              <CalcKey label="7" onClick={() => handleNum("7")} className={numKeyCls} />
              <CalcKey label="8" onClick={() => handleNum("8")} className={numKeyCls} />
              <CalcKey label="9" onClick={() => handleNum("9")} className={numKeyCls} />
              <CalcKey label="÷" onClick={() => handleOp("÷")} className={opKeyCls} />
              <CalcKey label="AC" onClick={handleClear} className={opKeyCls} />

              {/* Row 2 */}
              <CalcKey label="4" onClick={() => handleNum("4")} className={numKeyCls} />
              <CalcKey label="5" onClick={() => handleNum("5")} className={numKeyCls} />
              <CalcKey label="6" onClick={() => handleNum("6")} className={numKeyCls} />
              <CalcKey label="×" onClick={() => handleOp("×")} className={opKeyCls} />

              {/* = button: explicitly placed at col 5, spans rows 2-4 */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleEquals}
                className="col-start-5 row-start-2 row-span-3 btn-theme-green rounded-xl text-xl font-bold flex items-center justify-center active:opacity-60 touch-manipulation select-none h-full"
              >
                =
              </button>

              {/* Row 3 */}
              <CalcKey label="1" onClick={() => handleNum("1")} className={numKeyCls} />
              <CalcKey label="2" onClick={() => handleNum("2")} className={numKeyCls} />
              <CalcKey label="3" onClick={() => handleNum("3")} className={numKeyCls} />
              <CalcKey label="-" onClick={() => handleOp("-")} className={opKeyCls} />

              {/* Row 4 */}
              <CalcKey
                label="0"
                onClick={() => handleNum("0")}
                className={`col-span-2 ${numKeyCls}`}
              />
              <CalcKey label="." onClick={handleDot} className={numKeyCls} />
              <CalcKey label="+" onClick={() => handleOp("+")} className={opKeyCls} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
