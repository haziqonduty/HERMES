import { StatusScreen } from "@/components/status-screen";
import { ButtonLink } from "@/components/ui";

/** Shown inside the app shell when a record (engine, aircraft, defect, work order…) doesn't exist. */
export default function NotFound() {
  return (
    <StatusScreen
      code="RECORD NOT FOUND"
      title="Nothing here"
      actions={<ButtonLink href="/dashboard" variant="primary">Go to dashboard</ButtonLink>}
    >
      This record doesn&apos;t exist, or it was removed. Check the serial number, registration or link, or
      find it again from its module.
    </StatusScreen>
  );
}
