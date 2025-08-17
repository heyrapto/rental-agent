# 🏡 Rental Contract AO Agent — Full Spec Prompt

## 🎯 Objective

You are tasked with developing a **production-grade AO autonomous agent** and supporting **contract backend** that manages **rental agreements, payments, communications, maintenance, and disputes**, storing all immutable evidence on **Arweave**.

The codebase must be **structured, modular, and test-ready**, written at the level of a **senior engineer**, with **no runtime/test issues**.

---

## 🔑 Problem

Rental disputes arise because records (contracts, payments, communication) are **missing or alterable**. Immutable, timestamped evidence **reduces friction and cost**.

---

## 💡 Solution

An **AO agent** that:

* Manages **rental contracts, payments (USDA stablecoin first, extensible later), communication, and maintenance workflows**.
* Persists **all evidence (contracts, receipts, messages, tickets)** permanently to **Arweave**.
* Automates **reminders, escrow release, and SLA checks**.

---

## 👥 Users / Roles

* **Landlords**
* **Tenants**
* **Property Managers** (optional)
* **Agent Admin**

Authentication is **wallet-based (Arweave wallet address)**. Roles bound per lease.

---

## 📌 Functional Requirements

### 1. Identity & Roles

* Roles: `Landlord`, `Tenant`, `Manager`, `AgentAdmin`
* Wallet-based auth (Arweave address)
* Role binding per lease

### 2. Lease Lifecycle

* Draft lease (metadata + PDF/HTML body hash)
* Invite counter-party, both sign digitally
* Verify signatures → store final lease + metadata on Arweave
* **Versioning**: amendments create new immutable objects linked via parent\_tx

### 3. Payments

* Accept **USDA stablecoin** first; extensible for AR/USDC later
* Confirm on-chain payment → generate immutable **receipt** on Arweave
* Escrow flows:

  * Hold **security deposit** in USDA escrow
  * Release (full/partial) at lease end with deductions

### 4. Communication & Maintenance

* **In-app messaging** anchored to Arweave with thread IDs
* **Maintenance tickets**: create, assign, status transitions, uploads
* Every state change logged immutably

### 5. Dispute Package

* On request, build **signed/timestamped bundle** (lease, receipts, messages, tickets)
* Generate **Merkle root** and publish to Arweave for third-party resolution

### 6. Autonomy & Uptime

* **Internal scheduler**: rent reminders, overdue notices, deposit checks, SLA pings
* Must function **autonomously for 72+ hours**, with retries/backoff
* Logs + metrics → stored on Arweave

---

## 📌 Non-Functional Requirements

* **Permanence**: all artifacts stored on Arweave w/ content hash + metadata tags
* **Security**: signature verification on every mutation; ACLs per lease
* **Privacy**: encrypt PII client-side, persist ciphertext + metadata hash only
* **Cost efficiency**: compress docs, batch logs
* **Observability**: message traces, state snapshots for debugging

---

## 🏗 Architecture

### AO Agent (AOS/TypeScript or Lua)

* HTTP message handler (`POST /agent`)

* Actions:

  * `createLease`
  * `signLease`
  * `recordPayment`
  * `postMessage`
  * `createTicket`
  * `updateTicket`
  * `buildDisputePackage`

* Scheduler inside AO for automation

### Storage

* Arweave writes via SDK
* Structured metadata tags: `{ leaseId, party, action, txType }`

### Payments

* USDA stablecoin adapter → confirm tx via APIs/contract events
* Immutable receipt stored on Arweave

### Indexer (optional for hackathon)

* Reads Arweave tags → builds searchable index for frontend

---

## 🗂 Data Model

### Lease

```json
{
  "leaseId": "uuid",
  "landlordAddr": "arweaveAddr",
  "tenantAddr": "arweaveAddr",
  "termsHash": "sha256",
  "startDate": "iso8601",
  "endDate": "iso8601",
  "rent": "number",
  "currency": "USDA",
  "deposit": "number",
  "status": "draft|active|terminated",
  "signatures": ["sig1", "sig2"],
  "arTxId": "arweaveTx"
}
```

### Payment

```json
{
  "leaseId": "uuid",
  "payer": "arweaveAddr",
  "amount": "number",
  "currency": "USDA",
  "chainId": "string",
  "txHash": "string",
  "confirmedAt": "iso8601",
  "receiptArTxId": "arweaveTx"
}
```

### Message

```json
{
  "leaseId": "uuid",
  "sender": "arweaveAddr",
  "contentHash": "sha256",
  "createdAt": "iso8601",
  "arTxId": "arweaveTx"
}
```

### Ticket

```json
{
  "ticketId": "uuid",
  "leaseId": "uuid",
  "title": "string",
  "descriptionHash": "sha256",
  "status": "open|in-progress|closed",
  "evidenceArTxIds": ["arweaveTx1"],
  "events": ["event1", "event2"],
  "arTxId": "arweaveTx"
}
```

### Dispute Package

```json
{
  "leaseId": "uuid",
  "includedArTxIds": ["tx1","tx2"],
  "merkleRoot": "sha256",
  "packageArTxId": "arweaveTx"
}
```

---

## 📡 API Contract (AO HTTP Messaging)

### Endpoint

```
POST /agent
```

### Headers

* `x-sender-wallet: <walletAddr>`
* `x-sig: <signature>`
* `x-timestamp: <ISO8601>`

### Body Examples

#### createLease

```json
{
  "action": "createLease",
  "landlordAddr": "0x123...",
  "tenantAddr": "0x456...",
  "terms": "base64(pdf or html)",
  "rent": 1000,
  "currency": "USDA",
  "deposit": 2000
}
```

#### recordPayment

```json
{
  "action": "recordPayment",
  "leaseId": "uuid",
  "payer": "0x456...",
  "amount": 1000,
  "currency": "USDA",
  "chainId": "ethereum-mainnet",
  "txHash": "0xabcd..."
}
```

### Response

```json
{
  "ok": true,
  "leaseId": "uuid",
  "ticketId": "uuid",
  "arTxId": "arweaveTx",
  "error": null
}
```

---

## ✅ Deliverables

1. **Well-structured contract + backend codebase** (Javascript(Nodejs & express) for AO agent, Arweave SDK integration, USDA adapter).
2. **Immutable storage layer** (Arweave).
3. **Role-aware HTTP API** with signature validation.
4. **Autonomous scheduler** for reminders & escrow release.
5. **Complete test coverage** — all flows must run without issues.

---

👉 **Instruction for AI**:

* Use the **existing AO + Arweave codebase** where possible.
* Generate **modular, production-ready code** (no pseudo-code).
* Include **unit + integration tests**.
* Ensure **all contracts and agent code interoperate**.
* Optimize for **clarity, permanence, and testability**.