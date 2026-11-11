import { verify as verifySignature, X509Certificate } from "node:crypto";
import { APPLE_ROOT_CA_G3_PEM } from "./apple-root-ca.js";
import { env } from "./env.js";

/**
 * Verification of the JWS that Apple signs: StoreKit 2 transactions and renewal info, and App Store
 * Server Notifications V2. The steps follow Apple's own @apple/app-store-server-library
 * (SignedDataVerifier, without its online OCSP check):
 *
 * 1. The header is ES256 with an x5c chain of exactly three certificates (leaf, intermediate, root).
 * 2. The leaf carries Apple's "App Store receipt signing" extension (1.2.840.113635.100.6.11.1) and the
 *    intermediate the "WWDR intermediate" one (1.2.840.113635.100.6.2.1).
 * 3. The intermediate is issued and signed by a pinned root (Apple Root CA - G3, src/apple-root-ca.ts), and
 *    the leaf by the intermediate. The root in the JWS itself is never trusted.
 * 4. Both certificates were valid when the payload was signed (its signedDate; now if it has none).
 * 5. The JWS signature verifies with the leaf's P-256 key.
 *
 * It uses only node:crypto. The official library isn't a dependency because adding one changes the
 * monorepo's root lockfile, which the backend doesn't own.
 */

export type AppStoreJwsFailure = "malformed" | "chain" | "signature";

export class AppStoreJwsError extends Error {
  constructor(
    readonly reason: AppStoreJwsFailure,
    message: string,
  ) {
    super(message);
    this.name = "AppStoreJwsError";
  }
}

// DER encodings (content bytes) of the marker extension OIDs
const LEAF_OID = "2a864886f76364060b01"; // 1.2.840.113635.100.6.11.1
const INTERMEDIATE_OID = "2a864886f76364060201"; // 1.2.840.113635.100.6.2.1

let trustedRoots = [new X509Certificate(APPLE_ROOT_CA_G3_PEM)];

/** Tests sign their own JWS, so they swap the pinned root for a test one. Refused in production. */
export function setAppStoreTrustedRootsForTests(pems: string[]) {
  if (env.isProduction) throw new Error("The App Store root certificates can't be replaced in production");
  trustedRoots = pems.map((pem) => new X509Certificate(pem));
}

interface Tlv {
  tag: number;
  /** Content range within the buffer. */
  start: number;
  end: number;
}

function readTlv(buf: Buffer, at: number, limit: number): Tlv {
  if (at + 2 > limit) throw new Error("DER: truncated");
  const tag = buf[at]!;
  const first = buf[at + 1]!;
  let length = first;
  let start = at + 2;
  if (first & 0x80) {
    const n = first & 0x7f;
    if (n === 0 || n > 4 || start + n > limit) throw new Error("DER: bad length");
    length = 0;
    for (let i = 0; i < n; i++) length = length * 256 + buf[start + i]!;
    start += n;
  }
  if (start + length > limit) throw new Error("DER: truncated");
  return { tag, start, end: start + length };
}

function children(buf: Buffer, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let at = parent.start; at < parent.end; ) {
    const tlv = readTlv(buf, at, parent.end);
    out.push(tlv);
    at = tlv.end;
  }
  return out;
}

/** The OIDs of a certificate's X.509 v3 extensions, as hex of their DER content bytes. */
export function extensionOids(der: Buffer): Set<string> {
  const oids = new Set<string>();
  const certificate = readTlv(der, 0, der.length);
  const tbs = children(der, certificate)[0];
  if (!tbs || tbs.tag !== 0x30) throw new Error("DER: no TBSCertificate");
  // extensions are [3] EXPLICIT SEQUENCE OF Extension { extnID OID, critical BOOLEAN?, extnValue }
  const wrapper = children(der, tbs).find((field) => field.tag === 0xa3);
  if (!wrapper) return oids;
  const list = children(der, wrapper)[0];
  if (!list || list.tag !== 0x30) throw new Error("DER: bad extensions");
  for (const extension of children(der, list)) {
    const id = children(der, extension)[0];
    if (id?.tag === 0x06) oids.add(der.subarray(id.start, id.end).toString("hex"));
  }
  return oids;
}

function parseJson(part: string, what: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // falls through
  }
  throw new AppStoreJwsError("malformed", `The JWS ${what} isn't a JSON object`);
}

function split(jws: string) {
  const parts = typeof jws === "string" ? jws.split(".") : [];
  if (parts.length !== 3 || parts.some((p) => !p)) throw new AppStoreJwsError("malformed", "Not a compact JWS");
  return parts as [string, string, string];
}

/** The payload WITHOUT any verification. Only for reading which environment a JWS claims. */
export function decodeAppStoreJwsUnverified(jws: string): Record<string, unknown> {
  return parseJson(split(jws)[1], "payload");
}

function validAt(cert: X509Certificate, when: Date) {
  return cert.validFromDate.getTime() <= when.getTime() && when.getTime() <= cert.validToDate.getTime();
}

function hasOid(cert: X509Certificate, oid: string) {
  try {
    return extensionOids(cert.raw).has(oid);
  } catch {
    return false;
  }
}

/** Verifies a JWS signed by the App Store and returns its payload. Throws AppStoreJwsError. */
export function verifyAppStoreJws(jws: string): Record<string, unknown> {
  const [headerPart, payloadPart, signaturePart] = split(jws);
  const header = parseJson(headerPart, "header");
  if (header.alg !== "ES256") throw new AppStoreJwsError("malformed", "The JWS algorithm must be ES256");
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3 || x5c.some((c) => typeof c !== "string" || !c)) {
    throw new AppStoreJwsError("chain", "The JWS must carry a chain of three certificates (x5c)");
  }
  let leaf: X509Certificate;
  let intermediate: X509Certificate;
  try {
    leaf = new X509Certificate(Buffer.from(x5c[0] as string, "base64"));
    intermediate = new X509Certificate(Buffer.from(x5c[1] as string, "base64"));
  } catch {
    throw new AppStoreJwsError("chain", "The JWS certificates can't be parsed");
  }

  const payload = parseJson(payloadPart, "payload");
  // Signed JWS are stored and replayed long after the leaf expires, so its validity is judged at signing time
  const signedDate = payload.signedDate;
  const when = typeof signedDate === "number" && Number.isFinite(signedDate) ? new Date(signedDate) : new Date();

  if (!hasOid(leaf, LEAF_OID) || !hasOid(intermediate, INTERMEDIATE_OID)) {
    throw new AppStoreJwsError("chain", "The JWS certificates aren't App Store signing certificates");
  }
  const anchored = trustedRoots.some(
    (root) => validAt(root, when) && intermediate.checkIssued(root) && intermediate.verify(root.publicKey),
  );
  if (!anchored || !intermediate.ca) {
    throw new AppStoreJwsError("chain", "The JWS certificate chain doesn't lead to the Apple root CA");
  }
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) {
    throw new AppStoreJwsError("chain", "The JWS leaf certificate isn't signed by its intermediate");
  }
  if (!validAt(leaf, when) || !validAt(intermediate, when)) {
    throw new AppStoreJwsError("chain", "The JWS certificates weren't valid when it was signed");
  }

  const key = leaf.publicKey;
  const signature = Buffer.from(signaturePart, "base64url");
  const ok =
    key.asymmetricKeyType === "ec" &&
    key.asymmetricKeyDetails?.namedCurve === "prime256v1" &&
    signature.length === 64 &&
    verifySignature("sha256", Buffer.from(`${headerPart}.${payloadPart}`), { key, dsaEncoding: "ieee-p1363" }, signature);
  if (!ok) throw new AppStoreJwsError("signature", "The JWS signature is invalid");
  return payload;
}
