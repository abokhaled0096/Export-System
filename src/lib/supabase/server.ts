import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // بيتنفّذ من Server Component وده متوقّع — الـMiddleware هو المسؤول عن
            // تجديد الجلسة فعليًا، فتجاهل الخطأ ده آمن هنا.
          }
        },
      },
    }
  );
}

/**
 * ⚠️ استخدم الدالة دي، مش getSession() — getUser() بيتحقق من التوكن فعليًا مع
 * سيرفر المصادقة، بينما getSession() بيقرأ الكوكي وبس (قابل للتزوير).
 * قاعدة أمان صريحة في CLAUDE.md §قواعد الأمان.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
