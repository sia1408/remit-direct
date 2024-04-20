// Connect to the Ethereum network using Web3.js
const web3 = new Web3(Web3.givenProvider || 'http://localhost:8545');

// Replace with your contract's ABI and address
const contractABI = [/* Your contract's ABI in json */];
const contractAddress = '0x...'; // Your contract's address

// Create an instance of the smart contract
const remittancePayment = new web3.eth.Contract(contractABI, contractAddress);

// Function to send a payment
async function sendPayment() {
  const recipient = document.getElementById('recipient').value;
  const paymentId = document.getElementById('paymentId').value;
  const currency = document.getElementById('currency').value;
  const amount = document.getElementById('amount').value;

  try {
    const accounts = await web3.eth.requestAccounts();
    const sender = accounts[0];

    const amountInWei = web3.utils.toWei(amount, 'ether');

    await remittancePayment.methods.sendPayment(recipient, paymentId, currency, amountInWei)
      .send({ from: sender, value: amountInWei });

    showAlert('Payment sent successfully!', 'success');
    clearForm('sendPaymentForm');
  } catch (error) {
    console.error(error);
    showAlert('Failed to send payment. Please check the console for more details.', 'danger');
  }
}

// Function to claim a payment
async function claimPayment() {
  const paymentId = document.getElementById('claimPaymentId').value;

  try {
    const accounts = await web3.eth.requestAccounts();
    const recipient = accounts[0];

    await remittancePayment.methods.claimPayment(paymentId)
      .send({ from: recipient });

    showAlert('Payment claimed successfully!', 'success');
    clearForm('claimPaymentForm');
  } catch (error) {
    console.error(error);
    showAlert('Failed to claim payment. Please check the console for more details.', 'danger');
  }
}

// Function to show an alert message
function showAlert(message, type) {
  const alertContainer = document.createElement('div');
  alertContainer.className = `alert alert-${type} mt-3`;
  alertContainer.innerText = message;
  document.body.appendChild(alertContainer);

  setTimeout(() => {
    alertContainer.remove();
  }, 3000);
}

// Function to clear form fields
function clearForm(formId) {
  const form = document.getElementById(formId);
  form.reset();
}