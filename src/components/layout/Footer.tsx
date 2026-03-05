import { Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t px-6 py-8"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-background)",
      }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Copyright */}
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          © {year} James Castro. All rights reserved.
        </p>

        {/* Logo + tagline */}
        <Link to="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background:
                "color-mix(in srgb, var(--color-accent) 15%, transparent)",
            }}>
            <Dumbbell
              className="w-4 h-4"
              style={{ color: "var(--color-accent)" }}
            />
          </div>
          <div>
            <span
              className="font-bold text-sm tracking-tight"
              style={{ color: "var(--color-foreground)" }}>
              Gym<span style={{ color: "var(--color-accent)" }}>AI</span>
            </span>
            <span
              className="text-xs ml-2"
              style={{ color: "var(--color-muted)" }}>
              Train smarter, not harder.
            </span>
          </div>
        </Link>
      </div>
    </footer>
  );
}
