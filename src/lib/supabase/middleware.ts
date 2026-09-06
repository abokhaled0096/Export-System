import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ⚠️ getUser() لازم، مش getSession() — بيتحقق من التوكن فعليًا مع سيرفر
  // المصادقة بدل ما يقرأ الكوكي وبس. راجع src/lib/supabase/server.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  // طلب Server Action (بيحمل هيدر `Next-Action`) بيتوقّع رد بصيغة RSC خاصة، مش HTTP redirect
  // خام — لو الميدل وير عمل redirect() عادي هنا، الفرونت إند بيرمي "An unexpected response
  // was received from the server" بدل ما يترحّل صح (اكتُشف حيًا 30 أغسطس أثناء التحقق من إصلاح
  // باگ requireCurrentUser()/redirect() جوه catch — راجع BACKLOG.md § متابعة الأخطاء). الحل:
  // نسيب الطلب يوصل للـServer Action نفسها، واللي بتنادي requireCurrentUser() اللي بيعمل
  // redirect() من داخل سياق الـaction نفسه — ده بيولّد رد RSC-action صحيح الشكل بدل الـredirect
  // الخام. صفحات القراءة العادية (GET) لسه بتترحّل من هنا زي ما هي.
  const isServerAction = request.headers.has("next-action");

  if (!user && !isPublicPath && !isServerAction) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
