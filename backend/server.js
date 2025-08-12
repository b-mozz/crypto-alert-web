//server.js

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cors = require('cors');

// API Configuration from environment variables
const API_BASE_URL = process.env.CRYPTO_API_BASE_URL || 'https://api.coingecko.com/api/v3';
const API_URL = `${API_BASE_URL}/simple/price?ids=bitcoin,ethereum,dogecoin,litecoin&vs_currencies=usd&include_24hr_change=true`;
const app = express();

// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.HEROKU_APP_URL || true  // Allow all origins in production if no specific URL set
        : process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
};
app.use(cors(corsOptions));
// Persistent storage for user alerts
const ALERTS_FILE = path.join(__dirname, 'data', 'alerts.json');

// Nodemailer config - uses app passwords for Gmail
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

const NOTIFICATION_EMAIL = process.env.EMAIL_USER;

// Initialize email transport
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Alert file I/O operations
function readAlerts() {
    try {
        if (!fs.existsSync(ALERTS_FILE)) {
            // Ensure data directory exists
            const dir = path.dirname(ALERTS_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Bootstrap empty alerts file
            fs.writeFileSync(ALERTS_FILE, '[]');
            return [];
        }
        const data = fs.readFileSync(ALERTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading alerts file:', error);
        return [];
    }
}

function writeAlerts(alerts) {
    try {
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing alerts file:', error);
        return false;
    }
}

// Check active alerts against current market prices
async function checkAlerts(cryptoData) {
    try {
        const alerts = readAlerts();
        const activeAlerts = alerts.filter(alert => alert.active);
        
        for (const alert of activeAlerts) {
            const { coin, type, threshold } = alert;
            const coinData = cryptoData[coin];
            
            if (!coinData) {
                console.log(`⚠️ No price data found for ${coin}`);
                continue;
            }
            
            const currentPrice = coinData.price;
            let shouldTrigger = false;
            
            if (type === 'price_above' && currentPrice > threshold) {
                shouldTrigger = true;
            } else if (type === 'price_below' && currentPrice < threshold) {
                shouldTrigger = true;
            }
            
            if (shouldTrigger) {
                console.log(`🚨 Alert triggered for ${coin}: $${currentPrice} ${type} $${threshold}`);
                
                // Trigger email notification
                await sendNotification(alert, currentPrice, coinData);
                
                // Disable alert to prevent spam - could implement cooldown instead
                alert.active = false;
                writeAlerts(alerts);
                
                console.log(`Alert deactivated for ${coin} to prevent spam`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking alerts:', error);
    }
}

// Send formatted email notification when alert triggers
async function sendNotification(alertData, currentPrice, coinData) {
    try {
        const { coin, type, threshold } = alertData;
        const coinName = coinData.name || coin.charAt(0).toUpperCase() + coin.slice(1);
        const symbol = coinData.symbol || coin.toUpperCase();
        const change = coinData.change || 0;
        
        const condition = type === 'price_above' ? 'risen above' : 'dropped below';
        const arrow = change > 0 ? '📈' : '📉';
        const changeText = change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
        
        const mailOptions = {
            from: EMAIL_CONFIG.auth.user,
            to: NOTIFICATION_EMAIL,
            subject: `🚨 Crypto Alert: ${coinName} has ${condition} $${threshold}!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                        🚨 Crypto Price Alert
                    </h2>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #667eea; margin-top: 0;">
                            ${coinName} (${symbol}) Alert Triggered!
                        </h3>
                        
                        <div style="font-size: 18px; margin: 15px 0;">
                            <strong>Current Price:</strong> 
                            <span style="color: #28a745; font-size: 24px;">$${currentPrice.toLocaleString()}</span>
                        </div>
                        
                        <div style="font-size: 16px; margin: 10px 0;">
                            <strong>24h Change:</strong> 
                            <span style="color: ${change > 0 ? '#28a745' : '#dc3545'};">
                                ${arrow} ${changeText}
                            </span>
                        </div>
                        
                        <div style="font-size: 16px; margin: 10px 0;">
                            <strong>Alert Condition:</strong> 
                            Price ${condition} $${threshold.toLocaleString()}
                        </div>
                        
                        <div style="font-size: 14px; color: #666; margin-top: 20px;">
                            Alert created: ${new Date(alertData.createdAt).toLocaleString()}
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <p style="color: #666; font-size: 14px;">
                            This alert was sent by your Crypto Alert System
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Alert email sent for ${coinName} at $${currentPrice}`);
        return true;
        
    } catch (error) {
        console.error('❌ Error sending email notification:', error);
        return false;
    }
}


app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Server Configuration from environment variables
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
const alertCheckInterval = process.env.ALERT_CHECK_INTERVAL || 60000;

console.log(`🚀 Starting server in ${nodeEnv} mode...`);

// Fetch live prices from CoinGecko API
async function fetchCryptoPrices() {
    try {
        console.log("Fetching crypto prices...");
        const response = await axios.get(API_URL);
        const prices = response.data;
        
        // Structure response data in the format expected by frontend
        return {
            bitcoin: {
                name: 'Bitcoin',
                symbol: 'BTC', 
                price: prices.bitcoin.usd,
                change: prices.bitcoin.usd_24h_change
            },
            ethereum: {
                name: 'Ethereum',
                symbol: 'ETH',
                price: prices.ethereum.usd, 
                change: prices.ethereum.usd_24h_change
            },
            dogecoin: {
                name: 'Dogecoin',
                symbol: 'DOGE', 
                price: prices.dogecoin.usd,
                change: prices.dogecoin.usd_24h_change
            },
            litecoin: {
                name: 'Litecoin',
                symbol: 'LTC',
                price: prices.litecoin.usd,
                change: prices.litecoin.usd_24h_change
            }
        };
    } catch (error) {
        console.error("Error fetching crypto prices:", error.message);
        throw error;
    }
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Monitor prices in background to catch alerts 24/7
function startPriceMonitoring() {
    console.log('Starting background price monitoring service...');
    
    const monitorPrices = async () => {
        try {
            console.log('🔍 Checking prices and alerts...');
            const cryptoData = await fetchCryptoPrices();
            await checkAlerts(cryptoData);
        } catch (error) {
            console.error('❌ Error in background monitoring:', error);
        }
    };
    
    // Run initial check on startup
    monitorPrices();
    
    // Schedule recurring checks using environment variable
    setInterval(monitorPrices, parseInt(alertCheckInterval));
}

app.listen(port, () =>{
    console.log(`🌐 Server is running on http://localhost:${port}`);
    console.log(`📧 Email notifications will be sent to: ${NOTIFICATION_EMAIL}`);
    console.log(`⏰ Price monitoring interval: ${alertCheckInterval}ms`);
    
    // Initialize background monitoring
    startPriceMonitoring();
})

app.get('/api/prices', async(req, res) =>{
    try{
        const cryptoData = await fetchCryptoPrices();
        
        // Process any triggered alerts
        await checkAlerts(cryptoData);
        
        res.json(cryptoData);
    } catch(error){
        res.status(500).json({ error: 'Failed to fetch crypto prices' });   
    }
})

app.get('/api/stats', async (req, res) => {
    try {
        const alertsData = readAlerts();
        const activeAlerts = alertsData.filter(alert => alert.active).length;
        
        res.json({
            success: true,
            data: {
                monitoredCoins: 4,  // Bitcoin, Ethereum, Dogecoin, Litecoin
                activeAlerts: activeAlerts,
                alertsSent: 12
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

app.post('/api/alerts', (req, res) => {
    try {
        const { coin, type, threshold } = req.body;
        
        console.log('📝 Creating new alert:', { coin, type, threshold });
        
        // Load current alerts from storage
        const alerts = readAlerts();
        
        // Build alert object
        const newAlert = {
            id: alerts.length > 0 ? Math.max(...alerts.map(a => a.id)) + 1 : 1,
            coin: coin,
            type: type,
            threshold: threshold,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        // Append to alert list
        alerts.push(newAlert);
        
        // Save to file
        if (writeAlerts(alerts)) {
            console.log('✅ Alert created successfully!');
            console.log('📊 Total alerts:', alerts.length);
            
            res.json({ 
                success: true, 
                message: 'Alert created successfully',
                alert: newAlert 
            });
        } else {
            res.status(500).json({ error: 'Failed to save alert to file' });
        }
        
    } catch (error) {
        console.error('❌ Error creating alert:', error);
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// GET /api/alerts - Get all current alerts  
app.get('/api/alerts', (req, res) => {
    try {
        const alerts = readAlerts();
        console.log('📋 Fetching current alerts...');
        console.log('📊 Found', alerts.length, 'alerts');
        
        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('❌ Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// DELETE /api/alerts/:id - Delete a specific alert
app.delete('/api/alerts/:id', (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
        const alerts = readAlerts();
        
        const alertIndex = alerts.findIndex(alert => alert.id === alertId);
        
        if (alertIndex === -1) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        
        // Remove the alert
        alerts.splice(alertIndex, 1);
        
        // Save to file
        if (writeAlerts(alerts)) {
            console.log('🗑️ Alert deleted successfully:', alertId);
            res.json({ 
                success: true, 
                message: 'Alert deleted successfully' 
            });
        } else {
            res.status(500).json({ error: 'Failed to save changes to file' });
        }
        
    } catch (error) {
        console.error('❌ Error deleting alert:', error);
        res.status(500).json({ error: 'Failed to delete alert' });
    }
});

// POST /api/test-email - Send a test email notification
app.post('/api/test-email', async (req, res) => {
    try {
        console.log('📧 Sending test email...');
        
        const testAlert = {
            coin: 'bitcoin',
            type: 'price_above',
            threshold: 50000,
            createdAt: new Date().toISOString()
        };
        
        const testCoinData = {
            name: 'Bitcoin',
            symbol: 'BTC',
            price: 95000,
            change: 2.45
        };
        
        const success = await sendNotification(testAlert, testCoinData.price, testCoinData);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Test email sent successfully!' 
            });
        } else {
            res.status(500).json({ error: 'Failed to send test email' });
        }
        
    } catch (error) {
        console.error('❌ Error sending test email:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});