# 🏡 Rental Contract AO Agent

A **production-grade autonomous agent** for managing rental agreements, payments, communications, maintenance, and disputes with **immutable storage on Arweave**.

## 🎯 Overview

This system solves rental disputes by providing **immutable, timestamped evidence** that reduces friction and cost. It consists of:

- **Smart Contracts**: Ethereum-based rental management with USDA stablecoin support
- **AO Agent**: Autonomous agent handling all rental operations
- **Arweave Integration**: Permanent, immutable storage for all evidence
- **Autonomous Scheduler**: Automated reminders, escrow management, and SLA monitoring

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   AO Agent      │    │   Arweave       │
│   (Client)      │◄──►│   (Node.js)     │◄──►│   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Ethereum      │
                       │   (Contracts)   │
                       └─────────────────┘
```

## 🚀 Features

### Core Functionality
- ✅ **Lease Management**: Create, sign, and manage rental agreements
- ✅ **Payment Processing**: USDA stablecoin payments with immutable receipts
- ✅ **Communication**: In-app messaging anchored to Arweave
- ✅ **Maintenance Tickets**: Create, track, and resolve maintenance issues
- ✅ **Dispute Resolution**: Evidence collection with Merkle root verification
- ✅ **Escrow Management**: Secure deposit handling with automated release

### Autonomous Features
- 🤖 **Rent Reminders**: Automated notifications before due dates
- 🤖 **Overdue Notices**: Escalation for late payments
- 🤖 **SLA Monitoring**: Track maintenance response times
- 🤖 **Deposit Verification**: Regular escrow balance checks
- 🤖 **Health Monitoring**: System status and performance tracking

### Security & Compliance
- 🔒 **Wallet Authentication**: Arweave wallet-based identity
- 🔒 **Signature Validation**: Cryptographic verification of all actions
- 🔒 **Role-Based Access**: Landlord, tenant, and manager permissions
- 🔒 **Immutable Records**: All evidence stored permanently on Arweave
- 🔒 **Audit Trail**: Complete history of all operations

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Foundry (for smart contracts)
- Arweave wallet
- Ethereum node access

### 1. Clone Repository
```bash
git clone <repository-url>
cd rental-contract-ao-agent
```

### 2. Install Dependencies
```bash
# Install contract dependencies
cd contract
forge install

# Install agent dependencies
cd ../agent
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 4. Deploy Smart Contracts
```bash
cd contract

# Set your private key
export PRIVATE_KEY=your_private_key_here

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript --rpc-url <your_rpc_url> --broadcast
```

### 5. Start AO Agent
```bash
cd ../agent

# Development mode
npm run dev

# Production mode
npm start
```

## 🔧 Configuration

### Environment Variables

#### Required
```bash
WALLET_PATH=./wallet.json          # Arweave wallet path
JWT_SECRET=your-secret-key        # JWT signing secret
```

#### Arweave
```bash
ARWEAVE_HOST=arweave.net          # Arweave gateway
ARWEAVE_NETWORK=mainnet           # Network (mainnet/testnet)
WALLET_PASSWORD=your-password     # Wallet password
```

#### Ethereum
```bash
ETHEREUM_RPC_URL=<rpc_url>        # Ethereum node RPC
RENTAL_CONTRACT_ADDRESS=<address>  # Deployed contract address
USDA_ADAPTER_ADDRESS=<address>     # USDA adapter contract
```

#### Scheduler
```bash
SCHEDULER_ENABLED=true             # Enable autonomous scheduler
RENT_REMINDER_DAYS=3              # Days before rent due
OVERDUE_NOTICE_DAYS=5             # Days after due date
```

## 📡 API Reference

### Base URL
```
POST /agent
```

### Authentication Headers
```http
x-sender-wallet: <arweave_wallet_address>
x-sig: <signature>
x-timestamp: <ISO8601_timestamp>
```

### Actions

#### Create Lease
```json
{
  "action": "createLease",
  "landlordAddr": "0x123...",
  "tenantAddr": "0x456...",
  "terms": "base64(pdf_or_html)",
  "rent": 1000,
  "currency": "USDA",
  "deposit": 2000,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

#### Sign Lease
```json
{
  "action": "signLease",
  "leaseId": "uuid"
}
```

#### Record Payment
```json
{
  "action": "recordPayment",
  "leaseId": "uuid",
  "amount": 1000,
  "currency": "USDA",
  "chainId": "ethereum-mainnet",
  "txHash": "0xabcd..."
}
```

#### Post Message
```json
{
  "action": "postMessage",
  "leaseId": "uuid",
  "content": "Message content",
  "threadId": "optional_thread_id"
}
```

#### Create Maintenance Ticket
```json
{
  "action": "createTicket",
  "leaseId": "uuid",
  "title": "Leaky faucet",
  "description": "Kitchen faucet is leaking",
  "priority": "medium"
}
```

#### Build Dispute Package
```json
{
  "action": "buildDisputePackage",
  "leaseId": "uuid",
  "evidenceTypes": ["lease", "payment", "message"]
}
```

### Response Format
```json
{
  "ok": true,
  "leaseId": "uuid",
  "arTxId": "arweave_transaction_id",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 🧪 Testing

### Smart Contracts
```bash
cd contract
forge test
```

### AO Agent
```bash
cd agent
npm test
```

### Integration Tests
```bash
# Run all tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Build and start
npm start

# With PM2
pm2 start ecosystem.config.js
```

### Docker
```bash
docker build -t rental-agent .
docker run -p 3000:3000 rental-agent
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Status
```bash
curl http://localhost:3000/status
```

### Metrics
```bash
curl http://localhost:3000/metrics
```

## 🔍 Troubleshooting

### Common Issues

#### Arweave Connection Failed
- Check `ARWEAVE_HOST` and network configuration
- Verify wallet file exists and is valid
- Check internet connectivity

#### Signature Validation Failed
- Ensure wallet address format is correct (43 characters)
- Verify timestamp is within expiry window
- Check signature generation logic

#### Scheduler Not Running
- Verify `SCHEDULER_ENABLED=true`
- Check cron job configuration
- Review scheduler logs

### Logs
```bash
# View agent logs
tail -f logs/agent.log

# View error logs
tail -f logs/error.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discord**: [Community Server](link-to-discord)

## 🔗 Links

- **Website**: [rental-agent.com](https://rental-agent.com)
- **Documentation**: [docs.rental-agent.com](https://docs.rental-agent.com)
- **Smart Contracts**: [Etherscan](https://etherscan.io)
- **Arweave**: [arweave.org](https://arweave.org)

---

**Built with ❤️ for the decentralized rental economy**