# 🌿 UWell
### Mental Health Check-In & Counselor Booking Application for University Students

**Your wellbeing matters. Your support starts here.**

UWell is a mobile application designed to help university students monitor their emotional wellbeing, explore mental health resources, connect with counselors, and manage counseling appointments in one place.

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Mobile%20App-647D70?style=for-the-badge" alt="Mobile Application" />
  <img src="https://img.shields.io/badge/Domain-Student%20Wellbeing-D9A679?style=for-the-badge" alt="Student Wellbeing" />
  <img src="https://img.shields.io/badge/Project-IT3060%20HCI-8296B0?style=for-the-badge" alt="IT3060 HCI Project" />
</p>

---

## 🌱 About UWell

University life can bring academic pressure, stress, anxiety, and other emotional challenges. UWell aims to make wellbeing support and counseling services more accessible through a student-friendly mobile experience.

The application brings together mental health check-ins, wellness resources, counselor discovery, and appointment management.

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 Mental Health Check-In | Record mood check-ins and view wellbeing results. |
| 🌿 Wellness Resources | Explore mental wellbeing tips and resources. |
| 🔎 Counselor Search | Find counselors by their expertise and available information. |
| 📅 Appointment Booking | Select a counselor and book a counseling session. |
| 🔔 Appointment Updates | View booking confirmations and appointment details. |
| 👤 Profile & Settings | Access personal profile information and settings. |
| 🩺 Counselor Portal | Support counselor appointment workflows. |
| 📊 Management Dashboard | Present counseling-service summaries where implemented. |

## 📱 Student Journey

**Login → Home → Mood Check-In → Results → Find a Counselor → View Availability → Book Appointment → Confirmation → My Appointments**

This flow is designed to make the journey from checking in with personal wellbeing to accessing counseling support straightforward.

## 🛠️ Technology Stack

- **Mobile Frontend:** React Native, Expo
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Data Modeling:** Mongoose
- **API Communication:** Axios
- **Navigation:** React Navigation
- **Authentication:** JWT and bcrypt, where configured in the application

## 🏗️ System Architecture

```text
┌──────────────────────────────┐
│       UWell Mobile App       │
│   React Native + Expo        │
└──────────────┬───────────────┘
               │ HTTP / REST API
               ▼
┌──────────────────────────────┐
│       Backend API            │
│       Node.js + Express      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          MongoDB             │
│       Application Data       │
└──────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- Expo development environment
- MongoDB connection and required environment configuration

### 1. Clone the repository

```bash
git clone https://github.com/Nethm1/UWell.git
cd UWell
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

Open a second terminal:

```bash
cd UWell/backend
npm install
```

If your second terminal is already inside the project directory, use `cd backend` instead.

### 4. Configure environment variables

Set up the environment variables required by the backend, including the database connection and authentication secrets. Check the project configuration for the exact variable names.

Never commit passwords, API keys, database credentials, or real student information.

### 5. Start the application

Start the backend using the development command defined in `backend/package.json`.

Start the Expo frontend from the `frontend` directory:

```bash
npx expo start
```

Make sure the frontend API URL points to the correct backend address before testing.

## 🧪 Testing

Important areas for functional testing include:

- Login and registration validation
- Mood check-in submission and result display
- Counselor search and profile navigation
- Appointment booking and confirmation
- Appointment details and status
- Navigation between student screens
- Access restrictions for different user roles

Testing results should be documented based on actual executions.

## 🔐 Privacy & Security

Mental health information is sensitive. UWell should protect student information through appropriate authentication, access controls, secure configuration, and responsible data handling.

This project is not a substitute for professional mental health care or emergency assistance.

## 🎓 Academic Project

- **Module:** IT3060 – Human-Computer Interaction
- **Project:** UWell – Mental Health Check-In & Counselor Booking Application for University Students
- **Group:** WE_1.1_(WE_04)

## 👥 Project Contributors

UWell was developed as a collaborative university project covering student-facing interfaces, counselor workflows, and university management features.

Add each member's GitHub profile and confirmed contribution here.

## 🌼 Project Vision

UWell aims to encourage students to pay attention to their mental wellbeing and make it easier to explore appropriate university counseling support.

---

<p align="center">
  <i>Designed with student wellbeing in mind. 🌿</i>
</p>
