import { File } from "expo-file-system";

import { api } from "@/lib/api";

export type AttachmentKind = "image" | "audio";

export interface UploadedAttachment {
  kind: AttachmentKind;
  objectPath: string;
  mime: string;
  sizeBytes?: number;
  durationS?: number;
}

interface UploadUrlResponse {
  uploadURL: string;
  objectPath: string;
}

/**
 * Asks the API for a 15-min signed PUT URL bound to this session, then
 * streams the file bytes straight to GCS. Returns the canonical
 * `/objects/<id>` path that /api/chat expects in its `attachments` array.
 */
export async function uploadAttachment(opts: {
  sessionId: string;
  kind: AttachmentKind;
  uri: string;
  mime: string;
  durationS?: number;
}): Promise<UploadedAttachment> {
  const { sessionId, kind, uri, mime, durationS } = opts;

  const { uploadURL, objectPath } = await api<UploadUrlResponse>(
    "/api/attachments/upload-url",
    {
      method: "POST",
      body: JSON.stringify({ sessionId, kind, mime }),
    },
  );

  // Read the local file once so we can compute size and PUT a binary body.
  // Expo's File API exposes both .blob() (web) and .bytes() (native); we
  // pick whichever is available so the same code works on both targets.
  const file = new File(uri);
  let body: Blob | Uint8Array;
  let sizeBytes: number | undefined;
  if (typeof (file as unknown as { blob?: () => Promise<Blob> }).blob === "function") {
    body = await (file as unknown as { blob: () => Promise<Blob> }).blob();
    sizeBytes = (body as Blob).size;
  } else {
    const bytes = await (file as unknown as { bytes: () => Promise<Uint8Array> }).bytes();
    body = bytes;
    sizeBytes = bytes.byteLength;
  }

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: body as BodyInit,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }

  return { kind, objectPath, mime, sizeBytes, durationS };
}

/**
 * Resolves an attachment row to a short-lived GCS signed URL the client
 * can hand to <Image> or expo-audio. The server checks session
 * membership before signing, so unauthorized callers will 403.
 */
export async function fetchAttachmentURL(attachmentId: string): Promise<{
  url: string;
  mime: string;
  kind: AttachmentKind;
}> {
  return api<{ url: string; mime: string; kind: AttachmentKind }>(
    `/api/attachments/${attachmentId}/url`,
  );
}
