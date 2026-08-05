import { supabase } from "@/integrations/supabase/client";

/** Uploads a file to the private `media` bucket under {userId}/{kind}/{name} and returns a signed URL (1 year). */
export async function uploadMedia(
  userId: string,
  kind: "emoji" | "audio" | "chat-bg" | "app-bg" | "avatar" | "video" | "thumb",
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  // signed URL valid 1 year (private bucket)
  const { data, error: signErr } = await supabase.storage
    .from("media").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw new Error(signErr.message);
  return data.signedUrl;
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
