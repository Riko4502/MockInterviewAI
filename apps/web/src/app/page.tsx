import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { paths } from "@/shared/config";

export default async function RootPage() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken");

  redirect(refreshToken ? paths.dashboard : paths.login);
}
