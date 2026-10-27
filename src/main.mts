import type { ContractTag, ITagService } from "atq-types";
import fetch from "node-fetch";
const deployment = "QmWm8B4mtHRzwM8v2zhfYQYSxDGHDKfgbSmkpSHdtSLW5Q";
const endpoint = `https://gateway.thegraph.com/api/deployments/id/${deployment}`;
const provider = "0xb6a86025f0fe1862b372cb0ca18ce3ede02a318f";
const zero = "0x" + "0".repeat(40);
type Token = { id: string; name: string; symbol: string };
type Market = { id: string; protocol: { id: string }; inputToken: { id: string }; _sToken: Token | null; _vToken: Token | null };
type Meta = { deployment: string; hasIndexingErrors: boolean; block: { number: number; hash: string } };
function address(value: unknown, allowZero = false): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value) || !allowZero && value.toLowerCase() === zero) throw new Error("Unknown contract address");
  return value.toLowerCase();
}
function meta(value: unknown, initial?: Meta): Meta {
  const m = value as Meta;
  if (!m || m.deployment !== deployment || m.hasIndexingErrors !== false || !Number.isSafeInteger(m.block?.number) || m.block.number < 1 ||
      !/^0x[0-9a-f]{64}$/i.test(m.block.hash) || initial && (m.block.number !== initial.block.number || m.block.hash !== initial.block.hash)) throw new Error("Unknown or inconsistent source snapshot");
  return m;
}
async function query(text: string, apiKey: string): Promise<Record<string, unknown>> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query: text }), signal: controller.signal });
    if (!r.ok) throw new Error("Graph request failed");
    const d = await r.json() as { data?: unknown; errors?: unknown };
    if (!d || typeof d !== "object" || !d.data || typeof d.data !== "object" || Array.isArray(d.data) ||
        d.errors !== undefined && (!Array.isArray(d.errors) || d.errors.length)) throw new Error("Incomplete or invalid Graph response");
    return d.data as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}
const service: ITagService = {
  async returnTags(chainId: string, apiKey: string | null): Promise<ContractTag[]> {
    if (chainId !== "43114") throw new Error(`Unsupported Chain ID: ${chainId}`);
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("A Graph API key is required");
    const snapshot = meta((await query("{ _meta { deployment hasIndexingErrors block { number hash } } }", apiKey))._meta);
    const atBlock = `block: { hash: ${JSON.stringify(snapshot.block.hash)} }`;
    const tags: ContractTag[] = [], seen = new Set<string>(), labels = new Set<string>();
    let cursor = "0x";
    for (;;) {
      // Market IDs are unique addresses; no unique sequential source field exists.
      const d = await query(`{ _meta(${atBlock}) { deployment hasIndexingErrors block { number hash } }
        markets(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: ${JSON.stringify(cursor)} }, ${atBlock})
        { id protocol { id } inputToken { id } _sToken { id name symbol } _vToken { id name symbol } } }`, apiKey);
      meta(d._meta, snapshot);
      if (!Array.isArray(d.markets) || d.markets.length > 1000) throw new Error("Invalid market page");
      const rows = d.markets as Market[];
      for (const market of rows) {
        if (typeof market.id !== "string" || market.id <= cursor) throw new Error("Market cursor did not advance");
        cursor = market.id;
        const receipt = address(market.id), underlying = address(market.inputToken?.id);
        if (address(market.protocol?.id) !== provider) throw new Error("Unexpected source provider");
        // Stable and variable modes share Aave's DebtTokenBase category.
        // A null or literal zero role has no contract address to tag.
        for (const [mode, token] of [["stable", market._sToken], ["variable", market._vToken]] as const) {
          if (token === null) continue;
          const contract = address(token?.id, true);
          if (contract === zero) continue;
          const name = token.name, symbol = token.symbol;
          if (contract === receipt || contract === underlying || seen.has(contract) || typeof name !== "string" || !name || name !== name.trim() ||
              name.length > 50 || /[\u0000-\u001f\u007f]/.test(name) || typeof symbol !== "string" || !symbol || labels.has(name)) throw new Error("Unknown or ambiguous debt token metadata");
          seen.add(contract); labels.add(name);
          tags.push({ "Contract Address": `eip155:43114:${contract}`, "Project Name": "Aave", "Public Name Tag": name,
            "UI/Website Link": "https://aave.com", "Public Note": `Non-transferable Aave V2 ${mode}-rate debt token on Avalanche. Underlying: ${underlying}. Symbol: ${symbol}. Includes historical and zero-supply debt contracts; no claim of available new borrowing.` });
        }
      }
      if (rows.length < 1000) break;
    }
    return tags;
  },
};
export async function returnTags(chainId: string, apiKey: string): Promise<ContractTag[]> {
  return service.returnTags(chainId, apiKey);
}
