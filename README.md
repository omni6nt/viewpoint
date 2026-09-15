# Viewpoint

**TrustBonding intelligence for the Intuition ecosystem.**

Viewpoint is an independent dashboard for understanding $TRUST bonding on Intuition.

It turns on-chain Trust Bonding data into clear insights around positions, rewards, APY, utilization, lock duration, and network conditions.

## Live

https://Viewpoint-omni.vercel.app/

## What Viewpoint does

Viewpoint gives users a simpler way to understand what is happening with their $TRUST position and for new users to plan their stakes before checking the intuition portal.

### Calculator

Estimate how different bonding conditions could affect your projected rewards and APY.

You can explore:

- $TRUST amount
- Lock duration
- Bonded weight
- Personal utilization
- Network conditions
- Projected reward per epoch
- Projected annualized APY

### My Position

Look up a wallet address, ENS name, or TNS name to view its TrustBonding position and relevant on-chain data.

### Network Overview

View current network-level TrustBonding metrics including:

- Current APY
- Maximum APY
- Current epoch
- Total bonded $TRUST
- System utilization
- Epoch emissions

## How the calculations work

Viewpoint reads public on-chain data from the Intuition TrustBonding contracts.

For projections, the calculator models how lock duration affects bonded weight and how that weight could translate into a share of epoch emissions.

Projected values are estimates, not guaranteed future rewards.

## Tech Stack

- React
- Vite
- JavaScript
- viem
- Intuition L3
- TNS
- Vercel

## Running locally

Clone the repository:

```bash
git clone https://github.com/omni6nt/Viewpoint.git
cd Viewpoint

## Project Status

Viewpoint is actively being developed.

The core dashboard, TrustBonding calculator, wallet position lookup, live network data, mobile interface, and deployment pipeline are currently live.

Analytics and additional TrustBonding intelligence features are planned for future releases.

## Disclaimer

Viewpoint is an independent informational and educational tool.


Information displayed by Viewpoint is based on public on-chain data and calculations. Projected rewards and APY figures are estimates and may change as network conditions change.

Viewpoint does not execute transactions, hold funds, or provide financial or investment advice.

For full terms and privacy information, see:

- [Privacy Notice](https://Viewpoint-omni.vercel.app/legal/privacy.html)
- [Terms & Disclaimer](https://Viewpoint-omni.vercel.app/legal/terms.html)
- [Local Storage Notice](https://Viewpoint-omni.vercel.app/legal/storage.html)