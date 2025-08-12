# Crypto Alert Web Application

A real-time cryptocurrency price monitoring and alert system that sends email notifications when price thresholds are met.

## Features

- Real-time price monitoring for Bitcoin, Ethereum, Dogecoin, and Litecoin
- Email alerts when price thresholds are reached
- Modern dark theme UI with smooth animations
- Responsive design for all devices
- Background monitoring service
- Environment-based configuration

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **APIs**: CoinGecko API for crypto prices
- **Email**: Nodemailer with Gmail SMTP
- **Deployment**: Heroku-ready

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/crypto-alert-web.git
cd crypto-alert-web
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
   - Gmail credentials for email alerts
   - Other configuration options

5. Start the server:
```bash
npm start
```

6. Visit `http://localhost:3000`

### Heroku Deployment

1. Create a new Heroku app:
```bash
heroku create your-app-name
```

2. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set EMAIL_USER=your_email@gmail.com
heroku config:set EMAIL_PASS=your_gmail_app_password
heroku config:set CRYPTO_API_BASE_URL=https://api.coingecko.com/api/v3
heroku config:set ALERT_CHECK_INTERVAL=60000
```

3. Deploy:
```bash
git push heroku main
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (auto-set by Heroku) | No |
| `NODE_ENV` | Environment mode | No |
| `EMAIL_USER` | Gmail address for sending alerts | Yes |
| `EMAIL_PASS` | Gmail app password | Yes |
| `CRYPTO_API_BASE_URL` | CoinGecko API base URL | No |
| `ALERT_CHECK_INTERVAL` | Price check interval in ms | No |

## Gmail Setup

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this app password as `EMAIL_PASS`

## API Endpoints

- `GET /api/prices` - Get current crypto prices
- `GET /api/stats` - Get monitoring statistics
- `POST /api/alerts` - Create new alert
- `GET /api/alerts` - Get all alerts
- `DELETE /api/alerts/:id` - Delete alert
- `POST /api/test-email` - Send test email

## License

MIT License