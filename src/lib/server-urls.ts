interface NetworkAddress {
  address: string;
  family: string;
  internal: boolean;
}

export function getServerUrls(
  bindAddress: string,
  port: number,
  interfaces: Record<string, NetworkAddress[] | undefined>,
): string[] {
  if (bindAddress !== "0.0.0.0" && bindAddress !== "::") {
    return [`http://${bindAddress === "127.0.0.1" ? "localhost" : bindAddress}:${port}`];
  }

  const urls = [`http://localhost:${port}`];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (/docker|vethernet|wsl|virtual|loopback/i.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return [...new Set(urls)];
}
