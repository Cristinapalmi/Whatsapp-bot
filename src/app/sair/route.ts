import { isSameOrigin } from "@/lib/origin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  (await cookies()).delete("sid");
  return NextResponse.redirect(new URL("/", req.url), 303);
}
