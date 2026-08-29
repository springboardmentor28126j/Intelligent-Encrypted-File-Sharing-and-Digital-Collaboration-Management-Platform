# 🌍 FoodBridge — Global Food Waste Reduction Platform

A full-stack web application to connect food donors with receivers.

## 📁 Project Structure

```
food-waste-platform/
├── backend/
│   ├── app.py                  ← Main Flask application
│   ├── models.py               ← Database models
│   ├── requirements.txt        ← Python packages
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py             ← Login/Register APIs
│   │   ├── donations.py        ← Donation APIs
│   │   └── analytics.py        ← Chart data APIs
│   └── dataset/
│       └── seed_data.py        ← Sample data generator
└── frontend/
    ├── index.html              ← Landing page
    ├── dashboard.html          ← Analytics dashboard
    ├── donate.html             ← Donate food form
    ├── map.html                ← Interactive map
    └── login.html              ← Login / Register
```

---

## 🚀 Setup Instructions (VS Code)

### Step 1 — Open Project in VS Code
```bash
# Open the food-waste-platform folder in VS Code
# Then open a terminal: Terminal → New Terminal
```

### Step 2 — Create Virtual Environment
```bash
# Windows:
python -m venv venv
venv\Scripts\activate

# Mac/Linux:
python -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Step 4 — Seed the Database (Sample Data)
```bash
# Still inside backend/
python dataset/seed_data.py
```

You should see:
```
✅ Tables created.
✅ Created 10 users.
✅ Created 80 donations.
🎉 Database seeded successfully!
```

### Step 5 — Start the Backend Server
```bash
python app.py
```

You should see:
```
✅ Database tables created.
🌍 FoodBridge backend running at http://127.0.0.1:5000
* Running on http://127.0.0.1:5000
```

### Step 6 — Open the Frontend
Open your browser and go to:
```
http://127.0.0.1:5000
```

Or open `frontend/index.html` directly in your browser using VS Code Live Server extension.

---

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Donor | user1@example.com | password123 |
| Admin | admin@foodbridge.com | admin123 |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get JWT token |
| GET | /api/donations/ | List all donations |
| POST | /api/donations/ | Create donation (auth required) |
| PUT | /api/donations/{id}/claim | Claim a donation (auth required) |
| GET | /api/donations/stats | Get platform statistics |
| GET | /api/analytics/by-city | Donations grouped by city |
| GET | /api/analytics/by-food-type | Donations by food type |
| GET | /api/analytics/monthly-trend | Monthly donation trends |

---

## 🛠️ Troubleshooting

**"Module not found" error:**
```bash
pip install -r requirements.txt
```

**Port 5000 already in use:**
```bash
# Change port in app.py last line:
app.run(debug=True, port=5001)
# Then update API URLs in frontend HTML files from :5000 to :5001
```

**Database errors:**
```bash
# Delete the database and re-seed:
del backend\instance\foodwaste.db   # Windows
rm backend/instance/foodwaste.db    # Mac/Linux
python dataset/seed_data.py
```

**CORS errors in browser:**
Make sure Flask-CORS is installed: `pip install flask-cors`

---

## 🌟 Features

- ✅ User authentication (JWT tokens)
- ✅ Food donation listing with category, quantity, expiry
- ✅ Interactive map showing donation locations (Leaflet.js)
- ✅ Analytics dashboard with Chart.js charts
- ✅ Real-time impact calculation (meals, CO₂, water saved)
- ✅ Claim donations as a receiver
- ✅ Filter by city, food type, status
- ✅ SQLite database (no external DB needed)
- ✅ RESTful API backend

---

## 📊 Impact Calculations

| Metric | Formula |
|--------|---------|
| Meals saved | kg donated ÷ 0.4 |
| CO₂ prevented | kg × 2.5 kg CO₂ |
| Water conserved | kg × 1,000 liters |
