import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  (await cookies()).delete("sid");
  return NextResponse.redirect(new URL("/", req.url), 303);
}
