import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Link href="/" className="auth-brand" aria-label="HomeStock home">
          <Image src="/favicon.svg" alt="" width={34} height={34} priority />
          <span>HomeStock</span>
        </Link>
        <div>
          <span className="eyebrow">Your household, kept private</span>
          <h1>Welcome home.</h1>
          <p>Sign in with your own email. You will only see the household you belong to.</p>
        </div>
      </section>
      <section className="auth-form" aria-label="Sign in">
        <div className="auth-form-shell">
          <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
        </div>
      </section>
    </main>
  );
}
