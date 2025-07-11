// 1. Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
   apiKey: "AIzaSyAdmiUcQ_yZDL4Gg0r93HjqzPYQ6N-gzM8",
authDomain: "the-challenge-fa9b2.firebaseapp.com",
databaseURL: "https://the-challenge-fa9b2-default-rtdb.firebaseio.com",
projectId: "the-challenge-fa9b2",
storageBucket: "the-challenge-fa9b2.appspot.com",
messagingSenderId: "4102830619",
appId: "1:4102830619:web:581e033f36ec02708916be",
measurementId: "G-7M7JLK1V86"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. DOM Elements
const startScanButton = document.getElementById('startScanButton');
const qrCodeReader = document.getElementById('reader');
const scanResultDiv = document.getElementById('result');
const currentUserInfoDiv = document.getElementById('currentUserInfo');
const displayUserIdSpan = document.getElementById('displayUserId');
const displayUserCreditsSpan = document.getElementById('displayUserCredits');
const creditForm = document.getElementById('creditForm');
const creditAmountInput = document.getElementById('creditAmount');
const transactionTypeSelect = document.getElementById('transactionType');
const confirmButton = document.getElementById('confirmButton');
const cancelButton = document.getElementById('cancelButton');
const messageDiv = document.getElementById('message');

let currentScannedUserId = null; // To store the ID from the QR code

// Initialize the QR code scanner
const html5QrCode = new Html5Qrcode("reader");

// Function to start QR scanning
const startQrScan = () => {
    startScanButton.style.display = 'none';
    qrCodeReader.style.display = 'block';
    scanResultDiv.textContent = 'Scanning for QR code...';
    messageDiv.textContent = ''; // Clear previous messages
    currentUserInfoDiv.style.display = 'none';
    creditForm.style.display = 'none';

    html5QrCode.start(
        { facingMode: "environment" }, // Prefer rear camera
        {
            fps: 10,    // frames per second
            qrbox: { width: 250, height: 250 }  // QR box size
        },
        (decodedText, decodedResult) => {
            // QR code successfully scanned
            const userId = decodedText.trim();
            if (userId.length === 5 && !isNaN(userId)) { // Basic validation for 5-digit number
                scanResultDiv.textContent = QR Scanned! User ID: ${userId};
                currentScannedUserId = userId;
                html5QrCode.stop().then(() => {
                    qrCodeReader.style.display = 'none';
                    fetchUserCredits(userId);
                }).catch((err) => {
                    console.error("Failed to stop QR scanner:", err);
                    messageDiv.textContent = 'Error stopping scanner. Please refresh.';
                });
            } else {
                scanResultDiv.textContent = Invalid QR code: "${decodedText}". Please scan a 5-digit user ID.;
                messageDiv.textContent = 'Invalid QR code format. Please try again.';
            }
        },
        (errorMessage) => {
            // Error during scanning, or no QR code found yet
            // console.warn(QR Code scanning error: ${errorMessage});
        }
    ).catch((err) => {
        messageDiv.textContent = Error starting camera: ${err}. Please ensure camera access is granted.;
        console.error("Error starting QR scanner:", err);
        qrCodeReader.style.display = 'none';
        startScanButton.style.display = 'block'; // Show button again on error
    });
};

// Function to fetch user credits from Firebase
const fetchUserCredits = async (userId) => {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            displayUserIdSpan.textContent = userId;
            displayUserCreditsSpan.textContent = userData.credits || 0; // Default to 0 if credits field doesn't exist
            currentUserInfoDiv.style.display = 'block';
            creditForm.style.display = 'block';
            messageDiv.textContent = ''; // Clear any previous messages
        } else {
            messageDiv.textContent = User with ID ${userId} not found in database.;
            currentUserInfoDiv.style.display = 'none';
            creditForm.style.display = 'none';
            startScanButton.style.display = 'block'; // Allow scanning again
            currentScannedUserId = null;
        }
    } catch (error) {
        console.error("Error fetching user credits:", error);
        messageDiv.textContent = Error fetching user data: ${error.message};
        currentUserInfoDiv.style.display = 'none';
        creditForm.style.display = 'none';
        startScanButton.style.display = 'block'; // Allow scanning again
        currentScannedUserId = null;
    }
};

// Function to adjust user credits in Firebase
const adjustCredits = async (event) => {
    event.preventDefault(); // Prevent default form submission

    if (!currentScannedUserId) {
        messageDiv.textContent = 'No user scanned. Please scan a QR code first.';
        return;
    }

    const amount = parseFloat(creditAmountInput.value);
    const transactionType = transactionTypeSelect.value;

    if (isNaN(amount) || amount <= 0) {
        messageDiv.textContent = 'Please enter a valid positive number for the amount.';
        return;
    }

    const userRef = db.collection('users').doc(currentScannedUserId);

    try {
        // Use a transaction for atomic updates
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User does not exist!");
            }

            let currentCredits = userDoc.data().credits || 0;
            let newCredits;

            if (transactionType === 'add') {
                newCredits = currentCredits + amount;
                messageDiv.className = 'success';
                messageDiv.textContent = Successfully added ${amount} credits to user ${currentScannedUserId}.;
            } else { // subtract
                if (currentCredits < amount) {
                    throw new Error("Insufficient credits for subtraction.");
                }
                newCredits = currentCredits - amount;
                messageDiv.className = 'success';
                messageDiv.textContent = Successfully subtracted ${amount} credits from user ${currentScannedUserId}.;
            }

            transaction.update(userRef, { credits: newCredits });

            // IMPORTANT: If you manage an "admin" or "my" credit balance,
            // you would add logic here to update that balance as well within the same transaction.
            // Example (assuming an 'admin' document in a 'settings' collection):
            /*
            const adminRef = db.collection('settings').doc('admin');
            const adminDoc = await transaction.get(adminRef);
            let adminBalance = adminDoc.data().balance || 0;

            if (transactionType === 'add') {
                transaction.update(adminRef, { balance: adminBalance - amount }); // Admin loses credits
            } else { // subtract
                transaction.update(adminRef, { balance: adminBalance + amount }); // Admin gains credits
            }
            */

        });

        // Update displayed credits after successful transaction
        displayUserCreditsSpan.textContent = (transactionType === 'add') ? (parseFloat(displayUserCreditsSpan.textContent) + amount) : (parseFloat(displayUserCreditsSpan.textContent) - amount);
        creditAmountInput.value = ''; // Clear input

        // Reset UI after a short delay
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'error'; // Reset class
            currentUserInfoDiv.style.display = 'none';
            creditForm.style.display = 'none';
            startScanButton.style.display = 'block';
            currentScannedUserId = null;
        }, 3000); // 3 seconds
    } catch (error) {
        console.error("Error adjusting credits:", error);
        messageDiv.className = 'error';
        messageDiv.textContent = Error: ${error.message};
    }
};

// Event Listeners
startScanButton.addEventListener('click', startQrScan);
creditForm.addEventListener('submit', adjustCredits);
cancelButton.addEventListener('click', () => {
    // Stop scanner if it's running
    if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            qrCodeReader.style.display = 'none';
        }).catch((err) => {
            console.error("Error stopping scanner on cancel:", err);
        });
    }

    // Reset UI
    currentUserInfoDiv.style.display = 'none';
    creditForm.style.display = 'none';
    startScanButton.style.display = 'block';
    scanResultDiv.textContent = '';
    messageDiv.textContent = '';
    creditAmountInput.value = '';
    currentScannedUserId = null;
});

// Initial state
startScanButton.style.display = 'block';
