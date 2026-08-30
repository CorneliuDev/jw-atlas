import { getCurrentAppUser } from "@/lib/content/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentAppUser();
  return NextResponse.json({ user });
}
