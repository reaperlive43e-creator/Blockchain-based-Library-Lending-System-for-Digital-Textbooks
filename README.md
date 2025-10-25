# 📚 Blockchain-based Library Lending System for Digital Textbooks

Welcome to a revolutionary way to lend digital textbooks securely on the blockchain! This project addresses the rampant issue of digital textbook piracy by using timed access controls, ensuring that students get temporary access while publishers maintain control over their intellectual property. Built on the Stacks blockchain using Clarity smart contracts, it enables libraries to lend books digitally without the risk of unauthorized copying or sharing.

## ✨ Features

🔒 Secure registration of digital textbooks as NFTs to prevent duplication  
⏳ Timed access for borrowers, automatically revoking rights after the lending period  
💰 Integrated payment system for lending fees or deposits, with automatic refunds  
📖 User-friendly verification of book availability and borrowing history  
🚫 Anti-piracy measures through encrypted access keys and blockchain immutability  
👥 Role-based access for publishers, libraries, students, and admins  
📊 Analytics for tracking usage and royalties distribution  
✅ Dispute resolution mechanism for handling lending issues  

## 🛠 How It Works

This system leverages 8 Clarity smart contracts to create a decentralized library ecosystem. Publishers upload textbook metadata and hashes, libraries manage lending pools, and students borrow with time-bound access. All transactions are immutable and transparent on the Stacks blockchain.

### Key Smart Contracts
1. **UserRegistry.clar**: Handles user registration and role assignment (e.g., publisher, library, student). Stores user principals and verifies identities.
2. **TextbookNFT.clar**: Mints NFTs for each digital textbook instance. Each NFT represents a unique copy, storing metadata like title, author, ISBN hash, and content encryption key.
3. **LibraryInventory.clar**: Manages the library's stock of textbook NFTs. Allows libraries to add/remove books and check availability.
4. **LendingPool.clar**: Facilitates lending requests. Matches borrowers with available NFTs and initiates timed loans.
5. **TimedAccess.clar**: Enforces time-bound access. Uses blockchain timestamps to grant and revoke access automatically (e.g., 14-day loan periods).
6. **PaymentGateway.clar**: Processes STX token payments for borrowing fees or security deposits. Handles refunds upon successful return.
7. **RoyaltyDistributor.clar**: Automatically distributes royalties to publishers based on lending activity, using predefined splits.
8. **DisputeResolver.clar**: Allows admins to handle disputes (e.g., lost access or extensions) with voting or oracle integration for fairness.

**For Publishers**  
- Register your textbook by calling `mint-textbook` in TextbookNFT.clar with the content hash, title, and description.  
- Set royalty rates via RoyaltyDistributor.clar.  
Your books are now protected against piracy, as access is encrypted and time-limited.

**For Libraries**  
- Add textbooks to your inventory using LibraryInventory.clar.  
- Approve lending requests through LendingPool.clar, specifying loan durations.  

**For Students/Borrowers**  
- Register via UserRegistry.clar.  
- Browse available books and request a loan with payment via PaymentGateway.clar.  
- Access the book through TimedAccess.clar—decryption keys are released only during the active period. After expiration, access is revoked on-chain.  

**For Verifiers/Admins**  
- Use DisputeResolver.clar to review and resolve issues.  
- Query analytics from any contract for usage reports.  

This setup ensures no unauthorized sharing, as the blockchain enforces all rules without intermediaries. Boom—piracy-proof digital lending!  

## 🚀 Getting Started  
Clone the repo and deploy the Clarity contracts to a Stacks testnet. Use tools like Clarinet for local development and testing. For production, integrate with a frontend dApp for user interactions.  

Let's make education accessible and fair! 📖✨