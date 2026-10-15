import { Suspense } from "react";
import { IdentityCheck } from "./IdentityCheck";

export const metadata = { title: "Check your ID · SLAA Registration" };

export default function CheckPage() {
  return (
    <Suspense>
      <IdentityCheck />
    </Suspense>
  );
}
