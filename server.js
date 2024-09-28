const express = require('express');
const cors = require('cors'); // Add this line
const crypto = require('crypto');
const axios = require('axios');
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = 3000;

// Middleware to enable CORS for all routes
app.use(cors()); // Add this line to enable CORS for all origins

// Middleware to parse JSON request bodies
app.use(express.json());

// Route to create a new payment
app.post('/api/v1/new-payment', async (req, res) => {
    try {
        const merchantTransactionId = 'M' + Date.now();
        const { user_id, price, phone, name } = req.body;

        const data = {
            merchantId: process.env.MERCHANT_ID,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: 'MUID' + user_id,
            name: name,
            amount: price * 100, // Convert price to paise
            redirectUrl: `http://alhala.net/api/v1/status/${merchantTransactionId}`, // Redirect after payment
            redirectMode: 'POST',
            mobileNumber: phone,
            paymentInstrument: {
                type: 'PAY_PAGE',
            },
        };
        console.log(data)
        

        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString('base64');
        const keyIndex = 1;
        const stringToHash = payloadMain + '/pg/v1/pay' + process.env.SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        const options = {
            method: 'POST',
            url: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
            },
            data: {
                request: payloadMain,
            },
        };
        console.log(checksum)

        const response = await axios.request(options);
        if (response.data.success) {
            return res.status(200).json({ success: true, redirectUrl: response.data.data.instrumentResponse.redirectInfo.url });
        } else {
            return res.status(400).json({ success: false, message: 'Failed to initiate payment' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: error.message,
            success: false
        });
    }
});

// Route to check the status of a payment
app.post('/api/v1/status/:txnId', async (req, res) => {
    try {
        const merchantTransactionId = req.params['txnId'];
        const merchantId = process.env.MERCHANT_ID;
        const keyIndex = 1;

        const stringToHash = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + process.env.SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = sha256 + "###" + keyIndex;

        const options = {
            method: 'GET',
            url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': `${merchantId}`,
            },
        };

        const response = await axios.request(options);
        if (response.data.success === true) {
            return res.status(200).send({ success: true, message: "Payment Success" });
        } else {
            return res.status(400).send({ success: false, message: "Payment Failure" });
        }
    } catch (error) {
        
        res.status(500).send({ message: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
