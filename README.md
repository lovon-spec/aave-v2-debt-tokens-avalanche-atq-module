# Aave V2 Avalanche debt tokens

Retrieves the Aave V2 DebtTokenBase contract family, including stable and variable rate modes, from every indexed Avalanche market. The official base contract expressly describes the shared debt-token category: https://github.com/aave/protocol-v2/blob/master/contracts/protocol/tokenization/base/DebtTokenBase.sol

Deposit receipt aTokens and underlying assets are excluded. These non-transferable debt tokens account for borrowing positions, including historical and zero-supply contracts; the module makes no assertion that new borrowing is available.

Official Messari catalogue: https://github.com/messari/subgraphs/blob/master/deployment/deployment.json
Subgraph: 9nh6Ums63wFcoZpmegyPcAFtY3CAzQc3S6cuERALYMqa
Deployment: QmWm8B4mtHRzwM8v2zhfYQYSxDGHDKfgbSmkpSHdtSLW5Q
Protocol address-provider identity: 0xb6a86025f0fe1862b372cb0ca18ce3ede02a318f

All markets are paged with strict unique-address ID cursor pagination at one source block hash. No unique sequential cursor exists. Both debt-token fields are read for every market; only explicitly absent or zero-address token roles are not emitted. Unknown data, duplicate roles/names and names above 50 characters fail the whole call. Public names use the exact indexed token names without suffixes or truncation.

Build with Yarn. The only exported function is async returnTags(chainId, apiKey), with all logic in src/main.mts. Preparation only; no filing authority.
