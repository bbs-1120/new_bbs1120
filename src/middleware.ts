import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  const isPublicApi = req.nextUrl.pathname.startsWith("/api/status");

  // 認証APIとステータスAPIは常に許可
  if (isAuthApi || isPublicApi) {
    return NextResponse.next();
  }

  // ログインページへのアクセス
  if (isLoginPage) {
    if (isLoggedIn) {
      // ログイン済みならダッシュボードへリダイレクト
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 未ログインなら認証ページへリダイレクト
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};

