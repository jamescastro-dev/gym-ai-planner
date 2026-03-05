import { Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { UserButton } from "@neondatabase/neon-js/auth/react";

export default function Navbar() {
  const { user } = useAuth();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background:
                "color-mix(in srgb, var(--color-accent) 15%, transparent)",
            }}>
            <Dumbbell
              className="w-5 h-5"
              style={{ color: "var(--color-accent)" }}
            />
          </div>
          <span
            className="font-bold text-xl tracking-tight"
            style={{ color: "var(--color-foreground)" }}>
            Gym<span style={{ color: "var(--color-accent)" }}>AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  My Plan
                </Button>
              </Link>
              <UserButton size="sm" className="bg-accent" />
            </>
          ) : (
            <>
              <Link to="/auth/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth/sign-up">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
