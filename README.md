# RemittancePayment DApp

RemittancePayment is a decentralized application built on the Ethereum blockchain that facilitates secure and transparent remittance payments between parties. This DApp leverages smart contracts to enable users to send and receive payments in various currencies while providing a trustless environment and eliminating the need for intermediaries.

## Features

- **Secure Remittance Payments**: Users can initiate remittance payments by specifying the recipient's address, payment ID, currency, and amount. The smart contract ensures that the payment is securely held until claimed by the intended recipient.
- **Multi-Currency Support**: Support for multiple currencies via integration with Chainlink's decentralized oracle network, ensuring accurate and up-to-date exchange rates.
- **Time-Bound Payments**: Payments have a predefined expiration duration, after which the recipient can no longer claim the funds.
- **Fee Management**: The DApp charges a configurable fee percentage on each payment, with the collected fees accruable to the contract owner.
- **Access Control**: Only the contract owner can perform administrative tasks such as setting currency oracles, adjusting fee percentages, and withdrawing collected fees.
- **Pausable Operations**: The contract owner has the ability to pause or unpause the contract's operations, allowing for maintenance or emergency situations.
- **Transparent Transactions**: All payment transactions and state changes are recorded on the Ethereum blockchain, ensuring transparency and accountability.

## Installation

1. Clone the repository:

```
git clone https://github.com/your-username/remittance-dapp.git
```

2. Install the required dependencies:

```
cd remittance-dapp
npm install
```

3. Compile the smart contracts:

```
truffle compile
```

4. Start a local Ethereum network (e.g., Ganache):

```
ganache-cli
```

5. Deploy the contracts to the local network:

```
truffle migrate
```

## Usage

1. Start the Truffle console:

```
truffle console
```

2. Get an instance of the deployed `RemittancePayment` contract:

```javascript
const instance = await RemittancePayment.deployed()
```

3. Use the contract's functions to interact with the DApp, for example:

```javascript
// Send a payment
const paymentId = "0x..." // Replace with the payment ID
const recipient = "0x..." // Replace with the recipient's address
const currency = "USD"
const amount = web3.utils.toWei("1", "ether") // 1 ETH
await instance.sendPayment(recipient, paymentId, currency, amount, { value: amount, from: sender })

// Claim a payment
await instance.claimPayment(paymentId, { from: recipient })
```
## Contributing

Contributions are welcome after 21st April! Please follow the [contributing guidelines](link-to-contributing-guidelines) to get started.

## License

This project is licensed under the [MIT License](LICENSE).