"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

export function BarcodeScanner({ onDetected, onClose }: { onDetected: (barcode: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    const stopCamera = () => {
      controls?.stop();
      videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    };
    if (!videoRef.current) return;
    void reader.decodeFromVideoDevice(undefined, videoRef.current, (result, scanError) => {
      if (stopped) return;
      if (result) {
        stopped = true;
        stopCamera();
        onDetected(result.getText());
      } else if (scanError && scanError.name === "NotAllowedError") {
        setError("Camera access was denied. Enter the barcode manually instead.");
      } else if (scanError) {
        console.error("Barcode scanning error:", scanError);
      }
    }).then((resolvedControls) => {
      controls = resolvedControls;
      console.log("Barcode scanner initialized successfully");
    }).catch((error) => {
      console.error("Barcode scanner initialization error:", error);
      setError("Camera scanning is unavailable. Enter the barcode manually instead.");
    });
    return () => { stopped = true; stopCamera(); };
  }, [onDetected]);

  return <div className="modal-backdrop" role="presentation"><div className="modal-card scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title"><div className="modal-header"><div><div className="eyebrow">Inventory barcode</div><h2 id="scanner-title">Scan a product</h2></div><button type="button" className="icon-button" aria-label="Close scanner" onClick={onClose}>×</button></div><video ref={videoRef} className="barcode-video" muted playsInline />{error && <p className="form-hint">{error}</p>}<p className="form-hint">Point your camera at the product barcode. You can close this and enter it manually at any time.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Enter manually</button></div></div></div>;
}
