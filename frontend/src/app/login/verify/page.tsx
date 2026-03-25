import { Suspense } from "react";
import VerificationClient from "./VerificationClient";

export default function VerificationPage() {
    return (
        <Suspense fallback={<p className="p-8">Loading...</p>}>
            <VerificationClient />
        </Suspense>
    );
}