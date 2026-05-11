/**
 * Fullscreen image zoom overlay.
 *
 * Click-to-close backdrop, `×` button (design-system icon from Figma node
 * 2199:149), and Escape key. Used by the Floorplan / Isometric / Anchor /
 * Setup image previews when the user clicks the thumbnail to inspect.
 */

import { useEffect } from "react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageOverlay({ src, alt = "Preview", onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 32,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 28,
          height: 28,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="0.5" y="0.5" width="27" height="27" rx="5.5" stroke="#2B2E31" />
          <path
            d="M16.544 17.392L14 14.784L11.456 17.392L10.672 16.608L13.216 14L10.672 11.392L11.456 10.608L14 13.216L16.544 10.608L17.328 11.392L14.784 14L17.328 16.608L16.544 17.392Z"
            fill="#A1A6AA"
          />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw",
          maxHeight: "92vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}
