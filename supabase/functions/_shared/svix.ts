function bytesToB64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifySvixSignature(
  payload: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  const signatureHeader = headers.get("svix-signature") ?? "";
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${id}.${timestamp}.${payload}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signed),
  );
  const expected = bytesToB64(new Uint8Array(sig));

  const candidates = signatureHeader.split(" ").flatMap((part) => {
    const value = part.trim();
    if (!value) return [];
    const comma = value.indexOf(",");
    return [comma >= 0 ? value.slice(comma + 1) : value.replace(/^v1,/, "")];
  });
  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}
