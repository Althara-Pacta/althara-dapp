# Althara Pacta - Decentralized Tender Management DApp

A comprehensive decentralized application for managing government tenders using blockchain technology, built with Next.js, Tailwind CSS, and Web3 technologies.

## Features

- **Role-Based Access Control**: Government users can create tenders, vendors can submit bids
- **Filecoin Integration**: Official documents stored on Filecoin Calibration testnet
- **Smart Contract Management**: Tender and bid management on Sepolia testnet
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Smart Contracts

The DApp uses several smart contracts deployed on Sepolia testnet:

- **TenderContract**: Manages tender creation and lifecycle
- **BidSubmissionContract**: Handles bid submissions and evaluations

## Environment Setup

Create a `.env` file in the root directory with `cp .env.example .env`:

```env
# Sepolia Testnet Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Alchemy API Key
ALCHEMY_API_KEY="YOUR_API_KEY"

# Wallet Private Key
PRIVATE_KEY=""

# Infura API Key
NEXT_PUBLIC_INFURA_API_KEY="YOUR_API_KEY"

# WalletConnect Project ID
NEXT_PUBLIC_PROJECT_ID="YOUR_API_KEY"

# Filecoin Calibration Testnet Private Key (for document uploads)
PRIVATE_KEY=your_filecoin_private_key_here

# Optional: Contract Addresses (if different from defaults)
TENDER_CONTRACT_ADDRESS=YOUR_CONTRACT
BID_SUBMISSION_CONTRACT_ADDRESS=YOUR_CONTRACT
```

## Installation

1. Clone the repository:
```bash
git clone <https://github.com/Althara-Labs/althara-dapp>
cd althara-dapp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see Environment Setup above)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### For Government Users

1. **Connect Wallet**: Use MetaMask or another Web3 wallet
2. **Verify Role**: Ensure your wallet has GOVERNMENT_ROLE assigned (ask an admin or use /admin)
3. **Create Tender**:
   - Navigate to `/tenders/create-tender`
   - Fill in tender details (title, description, budget, deadline)
   - Upload official documents (PDF, DOC, DOCX, TXT)
   - Pay service fee (0.01 ETH)
   - Submit tender

### For Vendors

1. **Connect Wallet**: Use MetaMask or another Web3 wallet
2. **Browse Tenders**: View available tenders on the main page
3. **Submit Bids**: 
   - Select a tender
   - Provide bid details and price
   - Upload proposal documents
   - Pay bid submission fee

## Filecoin Integration

The DApp uses the Synapse SDK to upload documents to Filecoin Calibration testnet:

- **Network**: Calibration testnet
- **RPC URL**: https://api.calibration.node.glif.io/rpc/v1
- **Storage**: Documents are stored with Content Identifiers (CIDs)
- **Supported Formats**: PDF, DOC, DOCX, TXT (max 10MB)

## Smart Contract Functions

### TenderContract

- `createTender(description, budget, requirementsCid)`: Create a new tender
- `hasRole(role, account)`: Check if account has specific role
- `getTenderDetails(tenderId)`: Get tender information
- `markTenderComplete(tenderId)`: Mark tender as completed

### BidSubmissionContract

- `submitBid(tenderId, price, description, proposalCid)`: Submit a bid
- `acceptBid(tenderId, bidId)`: Accept a submitted bid
- `rejectBid(tenderId, bidId)`: Reject a submitted bid

## API Endpoints

### `/api/upload-document`

Handles file uploads to Filecoin:

- **Method**: POST
- **Content-Type**: multipart/form-data
- **Parameters**: 
  - `file`: File to upload
- **Response**: 
  ```json
  {
    "cid": "bafy...",
    "filename": "document.pdf",
    "size": 12345,
    "type": "application/pdf"
  }
  ```

## Development

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── upload-document/
│   │       └── route.ts
│   ├── tenders/
│   │   ├── create-tender/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   └── page.tsx
├── components/
│   └── landing/
└── lib/
    └── contracts/
        └── index.ts
```

### Key Technologies

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Web3**: wagmi, viem
- **Blockchain**: Ethereum (Sepolia), Filecoin (Calibration)
- **Storage**: Synapse SDK for Filecoin
- **Styling**: Tailwind CSS

### Testing

1. **Smart Contracts**: Deploy to Sepolia testnet
2. **Filecoin**: Use Calibration testnet for document storage
3. **Frontend**: Test with MetaMask connected to Sepolia

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on Github
- Contact the development team
- Check the documentation
----TEST------
