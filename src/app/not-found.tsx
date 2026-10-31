import { StatusScreen } from "@/components/status-screen";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Page not found" };

/** Unmatched URLs. Renders without the app shell. */
export default function NotFound() {
  return (
    <div className="relative isolate flex-1 overflow-hidden px-4 sm:px-6">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <StatusScreen
        code="ERROR 404"
        title="Page not found"
        actions={
          <>
            <ButtonLink href="/dashboard" variant="primary">Go to dashboard</ButtonLink>
            <ButtonLink href="/">Home</ButtonLink>
          </>
        }
      >
        The address may be mistyped, or the page has moved.
      </StatusScreen>
    </div>
  );
}
