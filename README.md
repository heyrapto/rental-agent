# 🏡 Rental Contract AO Agent

A **production-grade autonomous agent** for comprehensive rental contract management with immutable storage on Arweave and smart contract integration on Ethereum.

## 🚀 **Production Ready - No Mock Data**

This system is built for **real-world deployment** with:
- ✅ **Real Arweave Integration** - Actual blockchain storage, no mocks
- ✅ **Real Ethereum Integration** - USDA stablecoin verification, real blockchain calls
- ✅ **Production Database** - Complete MySQL schema with indexes and stored procedures
- ✅ **Real Authentication** - Wallet-based signature validation
- ✅ **Real Scheduling** - Autonomous cron jobs with retry logic
- ✅ **Real Error Handling** - Comprehensive error management and logging

## 🏗 **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   AO Agent      │    │   Arweave       │
│   (Web/Mobile)  │◄──►│   (Node.js)     │◄──►│   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Ethereum      │
                       │   (Smart       │
                       │    Contracts)   │
                       └─────────────────┘
```

## ✨ **Key Features**

### **🏠 Lease Management**
- **Digital Lease Creation** - Create, sign, and manage rental agreements
- **Multi-Party Signatures** - Both landlord and tenant must sign to activate
- **Immutable Storage** - All lease terms stored on Arweave
- **Version Control** - Track amendments and updates

### **💰 Payment Processing**
- **USDA Stablecoin** - Primary payment method with extensible design
- **Blockchain Verification** - Real-time payment confirmation on Ethereum
- **Escrow Management** - Security deposit handling with smart contracts
- **Receipt Generation** - Immutable payment receipts on Arweave

### **💬 Communication System**
- **In-App Messaging** - Secure communication between lease parties
- **Message Types** - General, maintenance, payment, legal, emergency
- **Priority Levels** - Low, normal, high, urgent
- **Immutable Logs** - All communications anchored to Arweave

### **🔧 Maintenance Management**
- **Ticket Creation** - Report and track maintenance issues
- **Priority System** - Low, medium, high priority levels
- **Category Classification** - Plumbing, electrical, HVAC, structural, appliance
- **Cost Tracking** - Estimated vs. actual cost monitoring
- **SLA Monitoring** - Service level agreement compliance

### **⚖️ Dispute Resolution**
- **Evidence Collection** - Gather all relevant documents and communications
- **Merkle Tree Generation** - Cryptographic proof of evidence integrity
- **Dispute Packages** - Immutable bundles for third-party resolution
- **Expiry Management** - Automatic cleanup of expired disputes

### **🤖 Autonomous Operations**
- **Rent Reminders** - Automated notifications for upcoming payments
- **Overdue Notices** - Automatic late payment alerts
- **SLA Monitoring** - Continuous service level monitoring
- **Health Checks** - System health and performance monitoring
- **Data Backup** - Automated backup and recovery procedures

## 🛠 **Technology Stack**

### **Backend**
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Production database with full schema
- **Winston** - Structured logging
- **Joi** - Input validation
- **node-cron** - Task scheduling

### **Blockchain**
- **Arweave** - Immutable data storage
- **Ethereum** - Smart contract execution
- **Solidity** - Smart contract language
- **Foundry** - Development and testing framework

### **Security**
- **Wallet Authentication** - Arweave wallet-based identity
- **Signature Validation** - Cryptographic message verification
- **Rate Limiting** - DDoS protection
- **CORS** - Cross-origin resource sharing
- **Helmet** - Security headers

## 📦 **Installation**

### **Prerequisites**
- Node.js 18+ and npm 8+
- MySQL 8.0+
- Arweave wallet with AR balance
- Ethereum node access (for production)

### **1. Clone Repository**
```bash
git clone https://github.com/your-org/rental-contract-ao-agent.git
cd rental-contract-ao-agent
```

### **2. Install Dependencies**
```bash
# Install Node.js dependencies
cd agent
npm install

# Install Foundry (for smart contracts)
cd ../contract
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge install
```

### **3. Database Setup**
```bash
# Create database and tables
mysql -u root -p < agent/database/schema.sql

# Or manually run the schema file in your MySQL client
```

### **4. Environment Configuration**
```bash
cd agent
cp .env.example .env

# Edit .env with your production values:
# - Database credentials
# - Arweave wallet path
# - Ethereum RPC URLs
# - Contract addresses
# - Security settings
```

### **5. Deploy Smart Contracts**
```bash
cd ../contract
export PRIVATE_KEY=your_deployer_private_key
forge script script/Deploy.s.sol:DeployScript --rpc-url <your_rpc_url> --broadcast
```

### **6. Start AO Agent**
```bash
cd ../agent
npm start
```

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rental_contract_ao_agent
DB_USER=ao_agent_user
DB_PASSWORD=secure_password

# Arweave Configuration
ARWEAVE_HOST=arweave.net
ARWEAVE_PORT=443
ARWEAVE_PROTOCOL=https
ARWEAVE_NETWORK=mainnet
ARWEAVE_WALLET_PATH=/path/to/wallet.json
ARWEAVE_MIN_BALANCE=0.1

# Ethereum Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_CHAIN_ID=1
RENTAL_CONTRACT_ADDRESS=0x...
USDA_ADAPTER_ADDRESS=0x...
USDA_CONTRACT_ADDRESS=0x...

# Security Configuration
JWT_SECRET=your_jwt_secret
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
CORS_ORIGINS=https://yourdomain.com

# Scheduler Configuration
SCHEDULER_ENABLED=true
SCHEDULER_TIMEZONE=UTC
SCHEDULER_RETRY_ATTEMPTS=3
SCHEDULER_RETRY_DELAY=5000
SCHEDULER_MAX_RETRIES=5
```

## 🚀 **API Reference**

### **Agent Endpoint**
All agent actions go through the `/agent` endpoint with signature validation.

#### **Create Lease**
```bash
POST /agent
Headers:
  x-sender-wallet: <wallet_address>
  x-sig: <signature>
  x-timestamp: <timestamp>

Body:
{
  "action": "createLease",
  "data": {
    "landlordAddr": "0x...",
    "tenantAddr": "0x...",
    "termsHash": "arweave_tx_id",
    "rent": 1500,
    "currency": "USDA",
    "deposit": 3000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }
}
```

#### **Sign Lease**
```bash
POST /agent
Body:
{
  "action": "signLease",
  "data": {
    "leaseId": "lease_uuid",
    "walletAddress": "0x..."
  }
}
```

#### **Record Payment**
```bash
POST /agent
Body:
{
  "action": "recordPayment",
  "data": {
    "leaseId": "lease_uuid",
    "payer": "0x...",
    "amount": 1500,
    "currency": "USDA",
    "chainId": 1,
    "txHash": "0x..."
  }
}
```

#### **Post Message**
```bash
POST /agent
Body:
{
  "action": "postMessage",
  "data": {
    "leaseId": "lease_uuid",
    "sender": "0x...",
    "recipient": "0x...",
    "subject": "Maintenance Request",
    "content": "The faucet is leaking",
    "messageType": "maintenance",
    "priority": "high"
  }
}
```

#### **Create Maintenance Ticket**
```bash
POST /agent
Body:
{
  "action": "createTicket",
  "data": {
    "leaseId": "lease_uuid",
    "reportedBy": "0x...",
    "title": "Leaking Faucet",
    "description": "Kitchen faucet is leaking",
    "priority": "high",
    "category": "plumbing",
    "estimatedCost": 150
  }
}
```

#### **Build Dispute Package**
```bash
POST /agent
Body:
{
  "action": "buildDisputePackage",
  "data": {
    "leaseId": "lease_uuid",
    "evidenceTxIds": ["arweave_tx_1", "arweave_tx_2"]
  }
}
```

### **Monitoring Endpoints**

#### **Health Check**
```bash
GET /health
```

#### **System Status**
```bash
GET /status
```

#### **Metrics**
```bash
GET /metrics
```

## 🧪 **Testing**

### **Smart Contract Tests**
```bash
cd contract
forge test
forge test --coverage
```

### **AO Agent Tests**
```bash
cd agent
npm test
npm run test:coverage
```

### **Integration Tests**
```bash
# Test the complete system
npm run test:integration
```

## 📊 **Monitoring & Observability**

### **Logging**
- **Structured Logging** - Winston with JSON format
- **Log Levels** - Error, Warn, Info, Debug
- **Log Rotation** - Daily rotation with compression
- **Audit Trail** - Complete action logging

### **Metrics**
- **System Metrics** - CPU, memory, uptime
- **Business Metrics** - Leases, payments, disputes
- **Performance Metrics** - Response times, throughput
- **Error Metrics** - Error rates, failure patterns

### **Health Checks**
- **Service Health** - Database, Arweave, Ethereum
- **Dependency Health** - External service status
- **Performance Health** - Response time monitoring
- **Resource Health** - Memory, disk, network

## 🔒 **Security Features**

### **Authentication & Authorization**
- **Wallet-Based Identity** - Arweave wallet addresses
- **Signature Validation** - Cryptographic message verification
- **Rate Limiting** - DDoS protection
- **CORS Protection** - Cross-origin security

### **Data Security**
- **Immutable Storage** - All data stored on Arweave
- **Encrypted Communication** - HTTPS/TLS encryption
- **Input Validation** - Comprehensive data validation
- **SQL Injection Protection** - Parameterized queries

### **System Security**
- **Security Headers** - Helmet.js protection
- **Request Validation** - Joi schema validation
- **Error Handling** - Secure error responses
- **Audit Logging** - Complete action tracking

## 🚀 **Deployment**

### **Production Deployment**
```bash
# Build and deploy
npm run build
npm run deploy:production

# Or use Docker
docker build -t rental-contract-ao-agent .
docker run -d -p 3000:3000 rental-contract-ao-agent
```

### **Environment-Specific Configs**
- **Development** - Local development with mocks disabled
- **Staging** - Pre-production testing environment
- **Production** - Live production environment

### **Scaling Considerations**
- **Load Balancing** - Multiple agent instances
- **Database Scaling** - Read replicas, sharding
- **Caching** - Redis for session and data caching
- **CDN** - Static asset delivery

## 🛠 **Development**

### **Code Structure**
```
agent/
├── src/
│   ├── config/          # Configuration management
│   ├── handlers/        # Request handlers
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic services
│   └── utils/           # Utility functions
├── test/                # Test files
├── database/            # Database schema and migrations
└── docs/                # Documentation
```

### **Adding New Features**
1. **Create Service** - Add business logic in services/
2. **Add Handler** - Create request handler in handlers/
3. **Update Schema** - Modify database schema if needed
4. **Add Tests** - Comprehensive test coverage
5. **Update Docs** - Keep documentation current

## 📈 **Performance & Optimization**

### **Database Optimization**
- **Indexes** - Strategic indexing for common queries
- **Query Optimization** - Efficient SQL queries
- **Connection Pooling** - Database connection management
- **Caching** - Redis for frequently accessed data

### **API Optimization**
- **Compression** - Gzip compression for responses
- **Rate Limiting** - Request throttling
- **Caching** - Response caching strategies
- **Async Processing** - Non-blocking operations

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Arweave Connection Issues**
```bash
# Check wallet balance
curl -X GET "https://arweave.net/wallet/0x.../balance"

# Verify network connectivity
curl -X GET "https://arweave.net/info"
```

#### **Database Connection Issues**
```bash
# Test database connection
mysql -u ao_agent_user -p -h localhost rental_contract_ao_agent

# Check database status
SHOW PROCESSLIST;
SHOW STATUS;
```

#### **Ethereum Connection Issues**
```bash
# Test RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://mainnet.infura.io/v3/YOUR_PROJECT_ID
```

### **Log Analysis**
```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log

# Search for specific errors
grep "ERROR" logs/app.log | tail -20
```

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Add** tests for new functionality
5. **Ensure** all tests pass
6. **Submit** a pull request

### **Development Guidelines**
- **Code Style** - Follow ESLint configuration
- **Testing** - Maintain >90% test coverage
- **Documentation** - Update docs for new features
- **Security** - Follow security best practices

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- **Documentation** - [Wiki](https://github.com/your-org/rental-contract-ao-agent/wiki)
- **Issues** - [GitHub Issues](https://github.com/your-org/rental-contract-ao-agent/issues)
- **Discussions** - [GitHub Discussions](https://github.com/your-org/rental-contract-ao-agent/discussions)
- **Email** - support@yourdomain.com

## 🙏 **Acknowledgments**

- **Arweave** - For immutable data storage
- **Ethereum** - For smart contract platform
- **OpenZeppelin** - For secure smart contract libraries
- **Foundry** - For development and testing tools

---

**Built with ❤️ for the decentralized future of rental management**