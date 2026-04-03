/**
 * GitHub webhook signature validator.
 */
const HEADER_PREFIX = "sha256=";
const HEX_RADIX = 16;

/**
 * @param {string} hex
 * @returns {Uint8Array | null}
 */
function decodeHex(hex) {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), HEX_RADIX);
  }
  return bytes;
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 * @returns {boolean}
 */
function isEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

/**
 * GitHub webhook signature validator.
 */
export default class Github_Flows_Web_Handler_Webhook_Signature {
  constructor() {
    this.isValid = async function ({ body, secret, signatureHeader }) {
      if (typeof secret !== "string" || typeof signatureHeader !== "string") {
        return false;
      }
      if (!signatureHeader.startsWith(HEADER_PREFIX)) {
        return false;
      }

      const received = decodeHex(signatureHeader.slice(HEADER_PREFIX.length));
      if (received === null) {
        return false;
      }

      const key = await globalThis.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const actual = new Uint8Array(
        await globalThis.crypto.subtle.sign("HMAC", key, body),
      );

      return isEqual(received, actual);
    };
  }
}

export const __deps__ = Object.freeze({
  default: Object.freeze({}),
});
