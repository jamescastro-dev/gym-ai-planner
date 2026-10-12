import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

interface PlanErrorProps {
  /** Already user-friendly (the backend sends one for every failure and limit). */
  message: string;
  /** Optional reassurance shown under the message, e.g. "Your current plan is unchanged." */
  note?: string;
}

/**
 * Shown whenever generating a plan fails or a limit is hit. It always offers the sample plan,
 * so a visitor can still see what the app produces.
 */
export function PlanError({ message, note }: PlanErrorProps) {
  return (
    <div
      role="alert"
      className="text-sm px-4 py-3 rounded-xl"
      style={{
        color: "#f87171",
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.2)",
      }}>
      <p>{message}</p>
      {note && (
        <p className="mt-1" style={{ color: "var(--color-muted)" }}>
          {note}
        </p>
      )}
      <Link to="/sample" className="block mt-3">
        <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto">
          View a sample plan
        </Button>
      </Link>
    </div>
  );
}
