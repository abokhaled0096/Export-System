import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

/** ⚠️ سيرفر بس — service_role key بيتخطّى RLS بالكامل، ممنوع يتلمس من Client Component. */
function getStorageAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY مش متظبط — راجع .env.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** بيرفع الملف ويرجّع الـstorage path (مش رابط) — Document.fileUrl بيخزّن الـpath ده، والرابط
 * الفعلي بيتولّد لحظيًا وقت التحميل عبر getSignedDocumentUrl (Signed URL قصير الصلاحية). */
export async function uploadDocumentFile(orgId: string, dealId: string, documentId: string, file: File): Promise<string> {
  const path = `${orgId}/${dealId}/${documentId}-${file.name}`;
  const supabase = getStorageAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(`فشل رفع الملف: ${error.message}`);
  return path;
}

export async function getSignedDocumentUrl(path: string, expiresInSeconds = 60): Promise<string> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`فشل توليد رابط الملف: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function deleteDocumentFile(path: string): Promise<void> {
  const supabase = getStorageAdminClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
