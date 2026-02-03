import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  
  // 公開ページ・API
  const isLoginPage = pathname === "/login";
  const isSetupPage = pathname === "/setup";
  const isRegisterPage = pathname === "/register";
  const isAuthApi = pathname.startsWith("/api/auth");
  const isPublicApi = pathname.startsWith("/api/status");
  const isScheduledApi = pathname.startsWith("/api/scheduled-send");
  const isScheduledOnExecute = pathname === "/api/scheduled-on/execute";
  const isAutoStopScheduled = pathname === "/api/auto-stop/scheduled";
  const isSetupApi = pathname.startsWith("/api/admin/setup");
  const isRegisterApi = pathname.startsWith("/api/register");
  const isDebugApi = pathname.startsWith("/api/debug-consecutive");
  const isSyncCampaignsApi = pathname === "/api/sync-campaigns";

  // 公開API・ページは常に許可
  if (isAuthApi || isPublicApi || isScheduledApi || isScheduledOnExecute || isAutoStopScheduled || isSetupApi || isRegisterApi || isDebugApi || isSyncCampaignsApi) {
    return NextResponse.next();
  }

  // ログイン・登録・セットアップページへのアクセス
  if (isLoginPage || isSetupPage || isRegisterPage) {
    if (isLoggedIn && isLoginPage) {
      // ログイン済みならダッシュボードへリダイレクト
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 管理者専用ページのチェック
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    }
    if (req.auth?.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 未ログインなら認証ページへリダイレクト
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};

