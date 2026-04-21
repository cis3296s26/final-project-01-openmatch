import { Suspense } from "react";
import InviteClient from "./InviteClient";

export default function VerificationPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading...</p>}>
      <InviteClient />
    </Suspense>
  );
}