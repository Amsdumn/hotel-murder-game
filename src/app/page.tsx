import { MainMenu } from "@/components/main-menu";
import { AccessScreen } from "@/components/access-screen";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accessCookieName, getAccessCookieValue, isAccessGranted, isValidAccessPassword } from "@/server/access-gate";

async function unlock(formData: FormData) {
  "use server";

  if (!isValidAccessPassword(formData.get("password"))) redirect("/?error=1");

  const cookieStore = await cookies();
  cookieStore.set(accessCookieName, getAccessCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (isAccessGranted(cookieStore.get(accessCookieName)?.value)) return <MainMenu />;

  const { error } = await searchParams;
  return <AccessScreen invalid={error === "1"} unlock={unlock} />;
}
