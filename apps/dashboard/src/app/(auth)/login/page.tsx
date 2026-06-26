import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f8fb_0%,#eaf0f8_100%)] px-4 py-10">
      <LoginForm />
    </main>
  );
}
