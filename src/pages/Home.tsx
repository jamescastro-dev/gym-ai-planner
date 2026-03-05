import { Link, Navigate } from "react-router-dom";
import {
  Zap,
  Target,
  Calendar,
  ArrowRight,
  Sparkles,
  Clock,
  Dumbbell,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Plans",
    description:
      "Get a training program tailored to your goals, experience, and schedule.",
  },
  {
    icon: Target,
    title: "Goal-Oriented",
    description:
      "Whether you want to build muscle, lose fat, or get stronger — we optimize for your goal.",
  },
  {
    icon: Calendar,
    title: "Flexible Scheduling",
    description:
      "Plans that fit your lifestyle. Train 2 days or 6 — we adapt to you.",
  },
  {
    icon: Clock,
    title: "Time-Efficient",
    description:
      "Every workout is designed to maximize results in your available time.",
  },
];

const stats = [
  { value: "3 minutes", label: "To get your workout plan" },
  { value: "100%", label: "Personalized" },
  { value: "Always", label: "Free forever" },
];

export default function Home() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{ background: "var(--color-background)" }}
    >
      <style>{`
        .feature-card {
          transition: transform 0.25s ease, border-color 0.25s ease;
          will-change: transform;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: color-mix(in srgb, var(--color-accent) 40%, transparent) !important;
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="relative flex items-center px-6 pt-26 pb-12">

        {/* Grid overlay — very subtle */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Single small glow orb — reduced for performance */}
        <div
          className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full opacity-10 pointer-events-none"
          style={{
            background: "var(--color-accent)",
            filter: "blur(70px)",
          }}
        />

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* ── LEFT ── */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-10 border"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                <Zap className="w-3 h-3" />
                Powered by AI
              </div>

              <h1
                className="font-bold leading-[1.05] tracking-tight mb-6"
                style={{ fontSize: "clamp(3rem, 8vw, 6rem)", color: "var(--color-foreground)" }}
              >
                Train smarter.
                <br />
                <span style={{ color: "var(--color-accent)" }}>Not harder.</span>
              </h1>

              <p
                className="text-lg leading-relaxed mb-10 max-w-xl"
                style={{ color: "var(--color-muted)" }}
              >
                Stop guessing at the gym. Get a personalized AI workout plan
                built around your goals, schedule, and equipment — in under 3 minutes.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-16">
                <Link to="/auth/sign-up">
                  <Button size="lg" className="gap-2 group">
                    Build My Plan
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link to="/auth/sign-in">
                  <Button variant="ghost" size="lg" style={{ color: "var(--color-muted)" }}>
                    Sign In
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-8">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
                      {s.value}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Dumbbell icon ── */}
            <div className="hidden lg:flex items-center justify-center relative h-120 ">

              {/* Soft glow behind icon */}
              <div
                className="absolute w-64 h-64 rounded-full pointer-events-none"
                style={{
                  background: "var(--color-accent)",
                  filter: "blur(60px)",
                  opacity: 0.12,
                }}
              />

              {/* Outer ring */}
              <div
                className="absolute w-96 h-96 rounded-full pointer-events-none"
                style={{
                  border: "1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)",
                }}
              />

              {/* Inner ring */}
              <div
                className="absolute w-72 h-72 rounded-full pointer-events-none"
                style={{
                  border: "1px dashed color-mix(in srgb, var(--color-accent) 20%, transparent)",
                }}
              />

              {/* Dumbbell icon */}
              <div
                className="relative flex items-center justify-center w-40 h-40 rounded-3xl"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  boxShadow: "0 0 60px color-mix(in srgb, var(--color-accent) 15%, transparent)",
                }}
              >
                <Dumbbell
                  className="w-20 h-20"
                  style={{ color: "var(--color-accent)" }}
                  strokeWidth={1.5}
                />
              </div>

              {/* Floating badge — top right */}
              <div
                className="absolute top-14 right-6 rounded-xl border px-3 py-2.5 flex items-center gap-2.5"
                style={{
                  background: "var(--color-card)",
                  borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
                >
                  <Target className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-foreground)" }}>Goal: Build Muscle</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>On track ✓</p>
                </div>
              </div>

              {/* Floating badge — bottom left */}
              <div
                className="absolute bottom-14 left-6 rounded-xl border px-3 py-2.5 flex items-center gap-2.5"
                style={{
                  background: "var(--color-card)",
                  borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-foreground)" }}>AI Plan Ready</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>Generated in 60s</p>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30"
          style={{ color: "var(--color-muted)" }}
        >
          <div
            className="w-px h-12"
            style={{ background: "linear-gradient(to bottom, transparent, var(--color-muted))" }}
          />
          <span className="text-xs tracking-widest uppercase">Scroll</span>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-12" style={{ background: "var(--color-accent)" }} />
            <span className="text-xs tracking-widest uppercase" style={{ color: "var(--color-accent)" }}>
              Why GymAI
            </span>
          </div>

          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight mb-16 max-w-lg"
            style={{ color: "var(--color-foreground)" }}
          >
            Everything you need.
            <br />
            <span style={{ color: "var(--color-muted)" }}>Nothing you don't.</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <Card
                key={feature.title}
                variant="bordered"
                className="feature-card group relative cursor-default"
              >
                <div
                  className="text-6xl font-black absolute top-4 right-5 leading-none select-none"
                  style={{ color: "color-mix(in srgb, var(--color-foreground) 4%, transparent)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
                </div>

                <h3 className="font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <Card variant="bordered" className="relative rounded-3xl! overflow-hidden text-center">
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 pointer-events-none"
              style={{
                background: "var(--color-accent)",
                filter: "blur(50px)",
                opacity: 0.12,
              }}
            />
            <div className="relative py-8 md:py-12">
              <h2
                className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
                style={{ color: "var(--color-foreground)" }}
              >
                Ready to start?
              </h2>
              <p className="text-lg mb-10" style={{ color: "var(--color-muted)" }}>
                Your first workout plan is free. No credit card required.
              </p>
              <Link to="/auth/sign-up">
                <Button size="lg" className="gap-2 group">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

    </div>
  );
}