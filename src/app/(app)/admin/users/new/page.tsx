import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CreateUserForm } from "../../forms";

export const metadata = { title: "Add user" };

export default async function NewUserPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Administration
      </Link>
      <PageHeader eyebrow="Administration" title="Add user" description="The account is ready to use immediately — no confirmation e-mail is sent." />
      {user.role === "admin" ? (
        <div className="panel rounded-2xl p-6 md:p-8">
          <CreateUserForm />
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted">
            Give the e-mail and temporary password to the user in person or through a secure channel. They should change it after first sign-in.
          </p>
        </div>
      ) : (
        <p className="panel rounded-2xl p-6 text-sm text-muted">Only administrators can add users.</p>
      )}
    </div>
  );
}
