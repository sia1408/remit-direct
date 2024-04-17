const RemittancePayment = artifacts.require("RemittancePayment");
const { expect } = require("chai");

contract("RemittancePayment", (accounts) => {
    let remittancePayment;
    const [owner, sender, recipient, thirdParty] = ["0x8a4C81BdC336B0acB7B9Ef63eDFe3d96Ff1e2835", "0x83B731dE4d4178a2b9f1A5B0043E6Bcec03F514C", "0x2e8d552d0Fa0f138d1e866dC7901C460892e810b", "0x716AC559ef0A1c129204E460cA08446b97C9b91D"];;
    const MIN_PAYMENT_AMOUNT = web3.utils.toBN(web3.utils.toWei("0.01", "ether"));
    const MAX_PAYMENT_AMOUNT = web3.utils.toBN(web3.utils.toWei("100", "ether"));
    const PAYMENT_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

    beforeEach(async () => {
        remittancePayment = await RemittancePayment.new({ from: owner });
    });

    describe("Access Control", () => {
        it("should grant OWNER_ROLE to the deployer", async () => {
            const ownerRole = await remittancePayment.OWNER_ROLE();
            const isOwner = await remittancePayment.hasRole(ownerRole, owner);
            expect(isOwner).to.be.true;
        });
    });

    describe("sendPayment", () => {
        it("should send a payment", async () => {
            const paymentId = web3.utils.sha3("payment1");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });

            const payment = await remittancePayment.payments(paymentId);
            expect(payment.sender).to.equal(sender);
            expect(payment.recipient).to.equal(recipient);
            expect(payment.amount).to.be.bignumber.equal(web3.utils.toBN(amount).mul(web3.utils.toBN(99)).div(web3.utils.toBN(100))); // Considering 1% fee
            expect(payment.claimed).to.be.false;
            expect(payment.expiration).to.be.bignumber.equal(web3.utils.toBN(await web3.eth.getBlock("latest")).add(web3.utils.toBN(PAYMENT_DURATION)));
        });

        it("should not allow sending a payment below the minimum amount", async () => {
            const paymentId = web3.utils.sha3("payment2");
            const amount = MIN_PAYMENT_AMOUNT.sub(web3.utils.toBN(1));

            await expect(remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount }))
                .to.be.revertedWith("InvalidPaymentAmount");
        });

        it("should not allow sending a payment above the maximum amount", async () => {
            const paymentId = web3.utils.sha3("payment3");
            const amount = MAX_PAYMENT_AMOUNT.add(web3.utils.toBN(1));

            await expect(remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount }))
                .to.be.revertedWith("InvalidPaymentAmount");
        });

        it("should not allow sending a payment with an existing payment ID", async () => {
            const paymentId = web3.utils.sha3("payment4");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });

            await expect(remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount }))
                .to.be.revertedWith("Payment ID already exists");
        });
    });

    describe("claimPayment", () => {
        it("should claim a payment", async () => {
            const paymentId = web3.utils.sha3("payment5");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });
            await remittancePayment.claimPayment(paymentId, { from: recipient });

            const payment = await remittancePayment.payments(paymentId);
            expect(payment.claimed).to.be.true;

            const recipientBalance = await web3.eth.getBalance(recipient);
            expect(web3.utils.toBN(recipientBalance)).to.be.bignumber.at.least(web3.utils.toBN(amount).mul(web3.utils.toBN(99)).div(web3.utils.toBN(100))); // Considering 1% fee
        });

        it("should not allow claiming a payment twice", async () => {
            const paymentId = web3.utils.sha3("payment6");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });
            await remittancePayment.claimPayment(paymentId, { from: recipient });

            await expect(remittancePayment.claimPayment(paymentId, { from: recipient }))
                .to.be.revertedWith("Payment has already been claimed");
        });

        it("should not allow claiming a payment by a non-recipient", async () => {
            const paymentId = web3.utils.sha3("payment7");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });

            await expect(remittancePayment.claimPayment(paymentId, { from: thirdParty }))
                .to.be.revertedWith("Only the recipient can claim the payment");
        });

        it("should not allow claiming an expired payment", async () => {
            const paymentId = web3.utils.sha3("payment8");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });
            await new Promise((resolve) => setTimeout(resolve, PAYMENT_DURATION * 1000)); // Wait for the payment to expire

            await expect(remittancePayment.claimPayment(paymentId, { from: recipient }))
                .to.be.revertedWith("Payment has expired");
        });
    });

    describe("Fee Management", () => {
        it("should deduct the fee from the payment amount", async () => {
            const paymentId = web3.utils.sha3("payment9");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });

            const payment = await remittancePayment.payments(paymentId);
            expect(payment.amount).to.be.bignumber.equal(web3.utils.toBN(amount).mul(web3.utils.toBN(99)).div(web3.utils.toBN(100))); // Considering 1% fee
        });

        it("should allow the owner to set the fee percentage", async () => {
            const newFeePercentage = 2;

            await remittancePayment.setFeePercentage(newFeePercentage, { from: owner });
            const feePercentage = await remittancePayment.feePercentage();
            expect(feePercentage).to.be.bignumber.equal(web3.utils.toBN(newFeePercentage));
        });

        it("should not allow non-owners to set the fee percentage", async () => {
            const newFeePercentage = 2;

            await expect(remittancePayment.setFeePercentage(newFeePercentage, { from: thirdParty }))
                .to.be.revertedWith("AccessControl");
        });
    });

    describe("Pause and Unpause", () => {
        it("should allow the owner to pause and unpause the contract", async () => {
            await remittancePayment.pause({ from: owner });
            expect(await remittancePayment.paused()).to.be.true;

            await remittancePayment.unpause({ from: owner });
            expect(await remittancePayment.paused()).to.be.false;
        });

        it("should not allow non-owners to pause or unpause the contract", async () => {
            await expect(remittancePayment.pause({ from: thirdParty }))
                .to.be.revertedWith("AccessControl");

            await expect(remittancePayment.unpause({ from: thirdParty }))
                .to.be.revertedWith("AccessControl");
        });

        it("should not allow sending payments when the contract is paused", async () => {
            const paymentId = web3.utils.sha3("payment10");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.pause({ from: owner });

            await expect(remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount }))
                .to.be.revertedWith("Pausable: paused");
        });

        it("should not allow claiming payments when the contract is paused", async () => {
            const paymentId = web3.utils.sha3("payment11");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });
            await remittancePayment.pause({ from: owner });

            await expect(remittancePayment.claimPayment(paymentId, { from: recipient }))
                .to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Withdraw", () => {
        it("should allow the owner to withdraw funds", async () => {
            const paymentId = web3.utils.sha3("payment12");
            const amount = web3.utils.toWei("1", "ether");

            await remittancePayment.sendPayment(recipient, paymentId, "USD", amount, { from: sender, value: amount });
            const initialOwnerBalance = await web3.eth.getBalance(owner);

            const withdrawAmount = web3.utils.toBN(amount).mul(web3.utils.toBN(1)).div(web3.utils.toBN(100)); // 1% of the payment amount
            await remittancePayment.withdraw(withdrawAmount, { from: owner });

            const finalOwnerBalance = await web3.eth.getBalance(owner);
            expect(web3.utils.toBN(finalOwnerBalance)).to.be.bignumber.at.least(web3.utils.toBN(initialOwnerBalance).add(withdrawAmount));
        });

        it("should not allow non-owners to withdraw funds", async () => {
            const withdrawAmount = web3.utils.toWei("1", "ether");

            await expect(remittancePayment.withdraw(withdrawAmount, { from: thirdParty }))
                .to.be.revertedWith("AccessControl");
        });
    });
})