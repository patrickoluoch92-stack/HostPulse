# 🚀 Complete Setup Guide - HostPulse Application

## ✅ Current Status Check

Based on the setup verification, here's what's installed and what needs to be done:

### ✅ Already Installed:
- **Node.js**: v24.11.1 ✓
- **npm**: 11.6.2 ✓
- **PostgreSQL**: Running (versions 14 and 15) ✓
- **Dependencies**: node_modules exists ✓
- **Environment File**: .env exists ✓
- **Prisma Client**: Generated ✓

### ⚠️ Needs Attention:
- **Database Connection**: May need correct credentials
- **Database Creation**: 'hostpulse' database may not exist
- **Migrations**: Need to be run if database is new

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Verify Database Credentials

Your `.env` file currently has:
```
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/hostpulse?schema=public"
```

**If this password is incorrect**, update the `.env` file with your actual PostgreSQL password.

**To find your PostgreSQL password:**
- Check if you set it during PostgreSQL installation
- Default might be: `postgres`, `admin`, or blank (empty password)
- If using pgAdmin, check your saved connections

**To update `.env`:**
1. Open `HostPulse/.env` in a text editor
2. Replace `postgres:postgres` with `your_username:your_password`
3. Save the file

---

### Step 2: Create the Database

If the database doesn't exist, create it using one of these methods:

#### Option A: Using psql (Command Line)
```powershell
# Connect to PostgreSQL (you'll be prompted for password)
psql -U postgres

# In psql prompt, run:
CREATE DATABASE hostpulse;

# Exit psql
\q
```

#### Option B: Using pgAdmin (GUI)
1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `hostpulse`
5. Click "Save"

#### Option C: Using SQL Command (if psql is in PATH)
```powershell
psql -U postgres -c "CREATE DATABASE hostpulse;"
```

---

### Step 3: Run Database Migrations

Once the database exists and credentials are correct:

```powershell
# Make sure you're in: C:\Users\DELL\HostPulse\HostPulse
npx prisma migrate dev --name init --schema=../prisma/schema.prisma
```

**Expected output:**
- Creates all tables (User, Property, Booking, Payment)
- Applies the schema to your database
- Generates Prisma Client

**If you get an error:**
- **"Authentication failed"**: Update `.env` with correct password
- **"Database does not exist"**: Create the database first (Step 2)
- **"Connection refused"**: Ensure PostgreSQL service is running

---

### Step 4: Verify Database Setup

Test the connection:
```powershell
npx prisma migrate status --schema=../prisma/schema.prisma
```

Should show: `Database schema is up to date`

---

### Step 5: Start the Backend API

**Open Terminal 1:**
```powershell
cd C:\Users\DELL\HostPulse\HostPulse
npx nx serve api.
```

**Wait for:**
```
🚀 Application is running on: http://localhost:3000/api
```

**If port 3000 is in use:**
- Change `PORT=3001` in `.env`
- Update `API_BASE` in `apps/src/app/page.tsx` to match

---

### Step 6: Start the Frontend

**Open a NEW Terminal 2:**
```powershell
cd C:\Users\DELL\HostPulse\HostPulse
npx nx serve apps
```

**Wait for:**
```
- Local:   http://localhost:4200
```

---

### Step 7: Test the Application

1. **Open Browser**: Navigate to `http://localhost:4200`

2. **Register a User**:
   - Click "Register" tab
   - Email: `test@example.com`
   - Password: `<REPLACE_WITH_YOUR_POSTGRES_PASSWORD>`
   - Phone (optional): `+254712345678`
   - Click "Register"
   - ✅ Should see "Successfully registered!" and be logged in

3. **Create a Booking** (requires test data):
   - First, create a Property in the database (see below)
   - Property ID: `1`
   - Start date: Future date (e.g., `2025-02-15`)
   - End date: After start date (e.g., `2025-02-20`)
   - Total: `10000`
   - M-PESA Phone: `+254712345678`
   - Click "Create Booking & Pay via M-PESA (Stub)"
   - ✅ Should see booking created + payment stub response

---

## 🧪 Adding Test Data

To test bookings, you need at least one Property in the database.

### Option 1: Using Prisma Studio (Easiest)

```powershell
npx prisma studio --schema=../prisma/schema.prisma
```

This opens a browser at `http://localhost:5555`:
1. Click "User" → Create a user (role: `host`)
2. Note the user ID
3. Click "Property" → Create a property (use the host's ID)

### Option 2: Using SQL

```sql
-- First, get or create a host user
-- If you registered via the app, use that user ID
-- Or create one:
INSERT INTO "User" (email, "hashedPassword", role) 
VALUES ('host@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'host')
RETURNING id;

-- Then create a property (replace 1 with the user ID from above)
INSERT INTO "Property" (name, description, location, amenities, price, "hostId", photos)
VALUES (
  'Nairobi Safari Lodge',
  'Beautiful lodge in Nairobi',
  '{"type":"Point","coordinates":[36.8219,-1.2921]}',
  ARRAY['WiFi', 'Pool', 'Safari'],
  5000.00,
  1,
  ARRAY['https://example.com/photo1.jpg']
);
```

---

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"
```powershell
npx prisma generate --schema=../prisma/schema.prisma
```

### "Database connection error"
- Check `.env` file has correct `DATABASE_URL`
- Ensure PostgreSQL service is running: `Get-Service postgresql*`
- Test connection manually

### "Port 3000 already in use"
- Change `PORT=3001` in `.env`
- Update `API_BASE` in `apps/src/app/page.tsx` to `http://localhost:3001/api`

### "JWT validation failed"
- Clear browser localStorage: DevTools → Application → Local Storage → Clear
- Re-login

### "Property not found" when booking
- Create a Property in database first (see "Adding Test Data" above)

### "Authentication failed" for database
- Update `.env` with correct PostgreSQL username and password
- Default format: `postgresql://username:password@localhost:5432/hostpulse?schema=public`

---

## 📁 Project Structure

```
HostPulse/
├── prisma/
│   └── schema.prisma          # Database schema
├── HostPulse/
│   ├── api./                   # NestJS Backend
│   │   └── src/
│   │       ├── auth/           # Login/Register
│   │       ├── bookings/       # Booking logic
│   │       ├── payments/       # M-PESA stub
│   │       └── prisma/         # Database service
│   ├── apps/                   # Next.js Frontend
│   │   └── src/app/
│   │       └── page.tsx        # Main page
│   ├── .env                    # Environment variables
│   └── package.json
└── SETUP_AND_RUN.ps1           # Setup verification script
```

---

## ✅ Quick Checklist

Before running the app, ensure:

- [ ] Node.js installed (v18+)
- [ ] npm installed
- [ ] PostgreSQL installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file exists with correct credentials
- [ ] Database `hostpulse` created
- [ ] Prisma Client generated
- [ ] Migrations run successfully
- [ ] Backend starts without errors
- [ ] Frontend starts without errors

---

## 🎉 You're Ready!

Once both servers are running:
- **Backend API**: `http://localhost:3000/api`
- **Frontend Web App**: `http://localhost:4200`

Open the frontend URL in your browser and start testing!

---

## 📞 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify all prerequisites are met
3. Ensure database credentials are correct
4. Check that both PostgreSQL and Node.js services are running
5. Review the troubleshooting section above

