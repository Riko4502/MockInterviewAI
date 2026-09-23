import * as dns from "node:dns/promises";
import * as net from "node:net";

/**
 * Удаляет квадратные скобки у IPv6 хостнеймов: `[::1]` -> `::1`.
 */
export function cleanIpHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "");
}

/**
 * Преобразует IPv4 адрес в BigInt.
 */
function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return null;
  }
  return (
    (BigInt(parts[0]) << 24n) |
    (BigInt(parts[1]) << 16n) |
    (BigInt(parts[2]) << 8n) |
    BigInt(parts[3])
  );
}

function inRangeIPv4(ipNum: bigint, cidrIp: string, maskBits: number): boolean {
  const cidrNum = ipv4ToBigInt(cidrIp);
  if (cidrNum === null) return false;
  const mask =
    maskBits === 0
      ? 0n
      : ((1n << 32n) - 1n) ^ ((1n << BigInt(32 - maskBits)) - 1n);
  return (ipNum & mask) === (cidrNum & mask);
}

/**
 * Проверяет, является ли IPv4 адрес приватным, локальным или зарезервированным.
 */
export function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToBigInt(ip);
  if (num === null) return true; // При некорректном IP отклоняем по безопасному принципу

  return (
    inRangeIPv4(num, "0.0.0.0", 8) || // 0.0.0.0/8 (включая 0.0.0.0/32)
    inRangeIPv4(num, "10.0.0.0", 8) || // 10.0.0.0/8 (Private)
    inRangeIPv4(num, "100.64.0.0", 10) || // 100.64.0.0/10 (CGNAT / Shared Address Space)
    inRangeIPv4(num, "127.0.0.0", 8) || // 127.0.0.0/8 (Loopback)
    inRangeIPv4(num, "169.254.0.0", 16) || // 169.254.0.0/16 (Link-local)
    inRangeIPv4(num, "172.16.0.0", 12) || // 172.16.0.0/12 (Private)
    inRangeIPv4(num, "192.0.0.0", 24) || // 192.0.0.0/24 (IETF Protocol)
    inRangeIPv4(num, "192.0.2.0", 24) || // 192.0.2.0/24 (TEST-NET-1)
    inRangeIPv4(num, "192.88.99.0", 24) || // 192.88.99.0/24 (6to4 Relay)
    inRangeIPv4(num, "192.168.0.0", 16) || // 192.168.0.0/16 (Private)
    inRangeIPv4(num, "198.18.0.0", 15) || // 198.18.0.0/15 (Benchmarking)
    inRangeIPv4(num, "198.51.100.0", 24) || // 198.51.100.0/24 (TEST-NET-2)
    inRangeIPv4(num, "203.0.113.0", 24) || // 203.0.113.0/24 (TEST-NET-3)
    inRangeIPv4(num, "224.0.0.0", 4) || // 224.0.0.0/4 (Multicast)
    inRangeIPv4(num, "240.0.0.0", 4) || // 240.0.0.0/4 (Reserved)
    num === 0xffffffffn // 255.255.255.255 (Broadcast)
  );
}

/**
 * Преобразует IPv6 адрес в BigInt.
 */
function parseIPv6(ip: string): bigint | null {
  let clean = cleanIpHostname(ip).toLowerCase();

  // Обработка IPv4-mapped IPv6 адресов (например, ::ffff:192.168.1.1)
  if (clean.includes(".")) {
    const lastColon = clean.lastIndexOf(":");
    const ipv4Part = clean.slice(lastColon + 1);
    const ipv4Num = ipv4ToBigInt(ipv4Part);
    if (ipv4Num === null) return null;
    const hex1 = Number((ipv4Num >> 16n) & 0xffffn).toString(16);
    const hex2 = Number(ipv4Num & 0xffffn).toString(16);
    clean = `${clean.slice(0, lastColon + 1)}${hex1}:${hex2}`;
  }

  const doubleColonCount = (clean.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let blocks: string[] = [];
  if (doubleColonCount === 1) {
    const [left, right] = clean.split("::");
    const leftBlocks = left && left.length > 0 ? left.split(":") : [];
    const rightBlocks = right && right.length > 0 ? right.split(":") : [];
    const missing = 8 - (leftBlocks.length + rightBlocks.length);
    if (missing < 1) return null;
    blocks = [...leftBlocks, ...Array(missing).fill("0"), ...rightBlocks];
  } else {
    blocks = clean.split(":");
  }

  if (blocks.length !== 8) return null;

  let result = 0n;
  for (let i = 0; i < 8; i++) {
    if (!blocks[i] || !/^[0-9a-f]{1,4}$/i.test(blocks[i])) return null;
    const val = BigInt(Number.parseInt(blocks[i], 16));
    result = (result << 16n) | val;
  }
  return result;
}

function inRangeIPv6(ipNum: bigint, cidrIp: string, maskBits: number): boolean {
  const cidrNum = parseIPv6(cidrIp);
  if (cidrNum === null) return false;
  const mask =
    maskBits === 0
      ? 0n
      : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - maskBits)) - 1n);
  return (ipNum & mask) === (cidrNum & mask);
}

/**
 * Проверяет, является ли IPv6 адрес приватным, локальным или зарезервированным.
 */
export function isPrivateIPv6(ip: string): boolean {
  // Если это IPv4-mapped IPv6, извлекаем и проверяем IPv4 часть
  const clean = cleanIpHostname(ip).toLowerCase();
  if (clean.includes(".")) {
    const lastColon = clean.lastIndexOf(":");
    const ipv4Part = clean.slice(lastColon + 1);
    if (net.isIPv4(ipv4Part)) {
      if (isPrivateIPv4(ipv4Part)) return true;
    }
  }

  const num = parseIPv6(ip);
  if (num === null) return true; // При некорректном IP отклоняем по безопасному принципу

  return (
    num === 0n || // ::/128 Unspecified
    num === 1n || // ::1/128 Loopback
    inRangeIPv6(num, "fc00::", 7) || // fc00::/7 Unique Local Address (ULA)
    inRangeIPv6(num, "fe80::", 10) || // fe80::/10 Link-Local
    inRangeIPv6(num, "ff00::", 8) || // ff00::/8 Multicast
    inRangeIPv6(num, "2001:db8::", 32) || // 2001:db8::/32 Documentation
    inRangeIPv6(num, "100::", 64) // 100::/64 Discard Prefix
  );
}

/**
 * Проверяет, является ли IP адрес (IPv4 или IPv6) приватным или зарезервированным.
 */
export function isPrivateIp(ipStr: string): boolean {
  const clean = cleanIpHostname(ipStr);
  const ipType = net.isIP(clean);

  if (ipType === 4) {
    return isPrivateIPv4(clean);
  }
  if (ipType === 6) {
    return isPrivateIPv6(clean);
  }
  return true; // Если не валидный IP-адрес, считаем небезопасным
}

export type CustomLookupFn = (
  hostname: string,
  options: unknown,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number,
  ) => void,
) => void;

export interface ValidatedUrlResult {
  fetchUrl: string;
  lookupFn?: CustomLookupFn;
  resolvedIp?: string;
}

/**
 * Разрешает DNS хостнейма и валидирует все IP на SSRF.
 * Возвращает кастомный lookupFn для `fetch` (чтобы зафиксировать проверенный IP и предотвратить DNS rebinding)
 * при сохранении оригинального URL (для корректной работы TLS / SNI).
 */
export async function resolveAndValidateUrl(
  urlStr: string,
): Promise<ValidatedUrlResult | null> {
  try {
    const parsedUrl = new URL(urlStr);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    const cleanHost = cleanIpHostname(parsedUrl.hostname);
    const ipType = net.isIP(cleanHost);

    // Если hostname уже является IP-адресом
    if (ipType !== 0) {
      if (isPrivateIp(cleanHost)) {
        return null;
      }
      return {
        fetchUrl: urlStr,
        resolvedIp: cleanHost,
      };
    }

    // Если hostname является доменным именем (DNS)
    const addresses = await dns.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      return null;
    }

    // Проверяем ВСЕ разрешённые адреса
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        return null;
      }
    }

    // Закрепляем первый проверенный IP адрес через кастомную функцию lookup
    const firstAddr = addresses[0];
    const lookupFn: CustomLookupFn = (_hostname, _options, callback) => {
      callback(null, firstAddr.address, firstAddr.family);
    };

    return {
      fetchUrl: urlStr,
      lookupFn,
      resolvedIp: firstAddr.address,
    };
  } catch {
    return null;
  }
}
