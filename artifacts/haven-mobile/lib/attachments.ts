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

interface FileWithBlob {
  blob?: () => Promise<Blob>;
  bytes?: () => Promise<Uint8Array>;
}

/**
 * Asks the API for a 15-minute signed PUT URL bound to this session, then
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

  const file = new File(uri) as unknown as FileWithBlob;
  let body: Blob | Uint8Array;
  let sizeBytes: number | undefined;
  if (typeof file.blob === "function") {
    const blob = await file.blob();
    body = blob;
    sizeBytes = blob.size;
  } else if (typeof file.bytes === "function") {
    const bytes = await file.bytes();
    body = bytes;
    sizeBytes = bytes.byteLength;
  } else {
    throw new Error("File reader not available on this platform");
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

export async function fetchAttachmentURL(attachmentId: string): Promise<{
  url: string;
  mime: string;
  kind: AttachmentKind;
}> {
  return api<{ url: string; mime: string; kind: AttachmentKind }>(
    `/api/attachments/${attachmentId}/url`,
  );
}
