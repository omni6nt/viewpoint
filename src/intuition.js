import { createPublicClient, http, formatUnits, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { TNSClient } from '@samoris/tns-sdk'

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ])
}

const intuitionChain = {
  id: 1155,
  name: 'Intuition',
  nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.intuition.systems'] },
  },
}

export const client = createPublicClient({
  chain: intuitionChain,
  transport: http('https://rpc.intuition.systems'),
})

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum.publicnode.com'),
})

const tnsClient = new TNSClient({ rpcUrl: 'https://intuition.calderachain.xyz' })

export const TRUST_BONDING_ADDRESS = '0x635bBD1367B66E7B16a21D6E5A63C812fFC00617'
export const MAXTIME_SECONDS = 63072000 // confirmed live: 2 years, NOT 4

export const TRUST_BONDING_ABI = [
  { name: 'currentEpoch', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'epochsPerYear', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalBondedBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getSystemUtilizationRatio', type: 'function', stateMutability: 'view', inputs: [{ name: '_epoch', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'getPersonalUtilizationRatio', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: '_epoch', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'userEligibleRewardsForEpoch', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'epoch', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'hasClaimedRewardsForEpoch', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'epoch', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'getSystemApy', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'currentApy', type: 'uint256' }, { name: 'maxApy', type: 'uint256' }] },
  { name: 'epochTimestampEnd', type: 'function', stateMutability: 'view', inputs: [{ name: 'epoch', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'emissionsForEpoch', type: 'function', stateMutability: 'view', inputs: [{ name: 'epoch', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'locked', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'tuple', components: [{ name: 'amount', type: 'int128' }, { name: 'end', type: 'uint256' }] }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getUserApy', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { name: 'getUserCurrentClaimableRewards', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

export async function fetchLiveNetworkData() {
  const currentEpoch = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'currentEpoch',
  })

  const epochsPerYear = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'epochsPerYear',
  })

  const totalBondedBalanceRaw = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'totalBondedBalance',
  })

  const [currentApyRaw, maxApyRaw] = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'getSystemApy',
  })

  const epochEndRaw = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'epochTimestampEnd',
    args: [currentEpoch],
  })

  let systemUtilizationRaw
  let utilizationEpochUsed = currentEpoch
  try {
    systemUtilizationRaw = await client.readContract({
      address: TRUST_BONDING_ADDRESS,
      abi: TRUST_BONDING_ABI,
      functionName: 'getSystemUtilizationRatio',
      args: [currentEpoch],
    })
  } catch {
    utilizationEpochUsed = currentEpoch - 1n
    systemUtilizationRaw = await client.readContract({
      address: TRUST_BONDING_ADDRESS,
      abi: TRUST_BONDING_ABI,
      functionName: 'getSystemUtilizationRatio',
      args: [currentEpoch - 1n],
    })
  }

  const emissionsForEpochRaw = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'emissionsForEpoch',
    args: [currentEpoch],
  })

  return {
    currentEpoch: Number(currentEpoch),
    epochsPerYear: Number(epochsPerYear),
    totalBondedBalance: Number(formatUnits(totalBondedBalanceRaw, 18)),
    systemUtilizationPercent: Number(systemUtilizationRaw) / 100,
    utilizationEpochUsed: Number(utilizationEpochUsed),
    currentApyPercent: Number(currentApyRaw) / 100,
    maxApyPercent: Number(maxApyRaw) / 100,
    epochEndTimestamp: Number(epochEndRaw) * 1000,
    derivedEpochEmissions: Number(formatUnits(emissionsForEpochRaw, 18)),
  }
}

export async function fetchUtilizationForEpoch(epoch) {
  const raw = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'getSystemUtilizationRatio',
    args: [BigInt(epoch)],
  })
  return Number(raw) / 100
}

export async function fetchEmissionsForEpoch(epoch) {
  const raw = await client.readContract({
    address: TRUST_BONDING_ADDRESS,
    abi: TRUST_BONDING_ABI,
    functionName: 'emissionsForEpoch',
    args: [BigInt(epoch)],
  })
  return Number(formatUnits(raw, 18))
}

export function isValidWalletAddress(address) {
  return isAddress(address)
}

async function readWalletEpochData(address, epoch) {
  const [personalUtilizationRaw, maxPotentialRaw, hasClaimed, lockedRaw, bondedWeightRaw, userApyRaw, claimableRaw] = await Promise.all([
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'getPersonalUtilizationRatio', args: [address, BigInt(epoch)] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'userEligibleRewardsForEpoch', args: [address, BigInt(epoch)] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'hasClaimedRewardsForEpoch', args: [address, BigInt(epoch)] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'locked', args: [address] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'balanceOf', args: [address] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'getUserApy', args: [address] }),
    client.readContract({ address: TRUST_BONDING_ADDRESS, abi: TRUST_BONDING_ABI, functionName: 'getUserCurrentClaimableRewards', args: [address] }),
  ])

  const personalUtilizationPercent = Number(personalUtilizationRaw) / 100
  const maxPotentialReward = Number(formatUnits(maxPotentialRaw, 18))
  const actualReward = maxPotentialReward * (personalUtilizationPercent / 100)
  const lockedAmount = Number(formatUnits(lockedRaw.amount < 0n ? -lockedRaw.amount : lockedRaw.amount, 18))
  const lockEndTimestamp = Number(lockedRaw.end) * 1000
  const bondedWeight = Number(formatUnits(bondedWeightRaw, 18))
  const [userCurrentApyRaw, userMaxApyRaw] = userApyRaw
  const claimableNow = Number(formatUnits(claimableRaw, 18))

  return {
    epochUsed: epoch,
    personalUtilizationPercent,
    maxPotentialReward,
    actualReward,
    hasClaimed,
    lockedAmount,
    lockEndTimestamp,
    bondedWeight,
    userCurrentApyPercent: Number(userCurrentApyRaw) / 100,
    userMaxApyPercent: Number(userMaxApyRaw) / 100,
    claimableNow,
  }
}

// Tries the live, in-progress epoch first so the reward can genuinely update as utilization changes.
// Falls back to the last completed epoch only if the live epoch reverts OR returns exactly 0
// (0 means "not computed yet," not "you earned nothing").
export async function fetchWalletRewardData(address, currentEpoch) {
  let data = null

  try {
    data = await readWalletEpochData(address, currentEpoch)
  } catch (err) {
    console.warn(`Live epoch ${currentEpoch} unavailable for wallet data, falling back`, err)
  }

  if (!data || data.maxPotentialReward === 0) {
    data = await readWalletEpochData(address, currentEpoch - 1)
  }

  return data
}

// Hypothetical projection for someone who hasn't staked yet — built entirely from verified real mechanics
export function projectNewLock({ amount, lockSeconds, totalBondedBalance, derivedEpochEmissions, epochsPerYear, personalUtilizationFraction }) {
  const cappedSeconds = Math.min(lockSeconds, MAXTIME_SECONDS)
  const projectedVeTrust = amount * (cappedSeconds / MAXTIME_SECONDS)
  const networkShare = projectedVeTrust / (totalBondedBalance + projectedVeTrust)
  const maxRewardPerEpoch = networkShare * derivedEpochEmissions
  const actualRewardPerEpoch = maxRewardPerEpoch * personalUtilizationFraction
  const annualizedApyPercent = amount > 0 ? (actualRewardPerEpoch * epochsPerYear / amount) * 100 : 0

  return {
    projectedVeTrust,
    networkShare,
    maxRewardPerEpoch,
    actualRewardPerEpoch,
    annualizedApyPercent,
  }
}

export async function resolveNameOrAddress(input) {
  const trimmed = input.trim()

  if (isAddress(trimmed)) {
    return { address: trimmed, resolvedFrom: null }
  }

  const lower = trimmed.toLowerCase()

  if (lower.endsWith('.eth')) {
    try {
      const resolved = await withTimeout(ensClient.getEnsAddress({ name: trimmed }), 8000, 'ENS lookup')
      if (!resolved) throw new Error('That ENS name does not resolve to an address')
      return { address: resolved, resolvedFrom: trimmed }
    } catch (err) {
      console.error('ENS resolution failed:', err)
      throw new Error('ENS resolution failed — the Ethereum RPC may be slow. Try again or paste the raw address.')
    }
  }

  if (lower.endsWith('.trust')) {
    try {
      const resolved = await withTimeout(tnsClient.resolveName(trimmed), 8000, 'TNS lookup')
      if (!resolved) throw new Error('That .trust name does not resolve to an address')
      return { address: resolved, resolvedFrom: trimmed }
    } catch (err) {
      console.error('TNS resolution failed:', err)
      throw new Error('TNS resolution failed — the network may be unstable. Try again or paste the raw address.')
    }
  }

  throw new Error('Enter a valid wallet address, an ENS (.eth) name, or a TNS (.trust) name')
}