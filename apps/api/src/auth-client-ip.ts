import { isIP } from "node:net";

export const AUTH_CLIENT_IP_HEADER = "x-superlog-auth-client-ip";

export type AuthClientIpInput = {
  peerIp?: string;
  forwardedFor?: string;
  behindTrustedProxy: boolean;
};

export function authBehindTrustedProxy(value: string | undefined): boolean {
  return value === "true";
}

function validIp(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

export function resolveAuthClientIp({
  peerIp,
  forwardedFor,
  behindTrustedProxy,
}: AuthClientIpInput): string | undefined {
  if (behindTrustedProxy) {
    const forwardedIp = forwardedFor?.split(",").at(-1);
    const clientIp = validIp(forwardedIp);
    if (clientIp) return clientIp;
  }

  return validIp(peerIp);
}

export function requestWithAuthClientIp(request: Request, clientIp: string | undefined): Request {
  const headers = new Headers(request.headers);
  headers.delete(AUTH_CLIENT_IP_HEADER);
  if (clientIp) headers.set(AUTH_CLIENT_IP_HEADER, clientIp);
  return new Request(request, { headers });
}
