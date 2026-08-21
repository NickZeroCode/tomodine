import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Embedded camera QR scanner with platform URL validation.
 *
 * Only accepts QR codes matching the table-menu schema this platform
 * generates (`/order/<token>`), so random external QR codes are rejected
 * instead of blindly navigating.
 */

const SCANNER_REGION_ID = "tomodine-qr-scanner-region";

type ScanState = "idle" | "starting" | "scanning" | "error";

export function QrScannerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setState("starting");
    setErrorMsg(null);

    const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
    scannerRef.current = scanner;

    const onScanSuccess = (decodedText: string) => {
      if (handledRef.current) return;
      // Validate the QR matches our table-menu schema before navigating.
      try {
        const url = new URL(decodedText);
        const match = url.pathname.match(/\/order\/([A-Za-z0-9_-]+)\/?$/);
        if (!match) {
          setErrorMsg(t("landing.qrInvalid"));
          return;
        }
        handledRef.current = true;
        stopScanner();
        navigate(`/order/${match[1]}`);
      } catch {
        // Not a valid absolute URL — reject.
        setErrorMsg(t("landing.qrInvalid"));
      }
    };

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          onScanSuccess,
          () => {
            /* per-frame decode failure — ignore */
          }
        );
        setState("scanning");
      } catch (err) {
        setState("error");
        setErrorMsg(t("landing.qrCameraError"));
        console.error("QR scanner failed to start:", err);
      }
    };
    void start();

    const stopScanner = async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        /* already stopped */
      }
    };

    return () => {
      void stopScanner();
      scanner.clear();
      scannerRef.current = null;
    };
  }, [open, navigate, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-lift">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-base font-bold text-ink-900">{t("landing.scanMenu")}</h2>
          <button
            type="button"
            onClick={() => {
              onClose();
              setErrorMsg(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-50"
            aria-label={t("common.close")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Camera viewport — framed like a native phone scanner */}
        <div className="relative bg-ink-900 p-4">
          <div id={SCANNER_REGION_ID} className="overflow-hidden rounded-2xl [&_video]:!rounded-2xl" />
          {/* Corner reticle overlay */}
          {(state === "scanning" || state === "starting") && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div className="relative h-56 w-56">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-brand-400" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-brand-400" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-400" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-brand-400" />
                {/* Scan line animation */}
                <span className="absolute left-2 right-2 top-1/2 h-0.5 animate-pulse rounded bg-brand-300/80" />
              </div>
            </div>
          )}
          {state === "starting" && (
            <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/70">{t("landing.qrStartingCamera")}</p>
          )}
        </div>

        {/* Footer / hints */}
        <div className="px-5 py-4 text-center">
          {errorMsg ? (
            <p className="text-sm font-medium text-red-600">{errorMsg}</p>
          ) : (
            <p className="text-xs leading-relaxed text-ink-500">{t("landing.qrHint")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
