import Image from "next/image";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Link href="/" className="auth-brand" aria-label="HomeStock home">
          <Image src="/favicon.svg" alt="" width={34} height={34} priority />
          <span>HomeStock</span>
        </Link>
        <div>
          <span className="eyebrow">Approved email required</span>
          <h1>Join your household.</h1>
          <p>Use the email address that was added to your HomeStock household.</p>
        </div>
      </section>
      <section className="auth-form" aria-label="Create account">
        <div className="auth-form-shell">
          <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/" />
        </div>
      </section>
    </main>
  );
}
