# 🌿 UWell
### Mental Health Check-In & Counselor Booking Application for University Students

**Supporting student wellbeing. Connecting students with care.**

UWell is a mobile application designed to help university students monitor their emotional wellbeing, discover counseling services, and manage counseling appointments through a single digital platform.

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Mobile-6C63FF?style=for-the-badge" alt="Mobile platform" />
  <img src="https://img.shields.io/badge/Focus-Student%20Wellbeing-14B8A6?style=for-the-badge" alt="Student wellbeing" />
  <img src="https://img.shields.io/badge/Project-IT3060-2563EB?style=for-the-badge" alt="IT3060 project" />
</p>

---

## 💜 About UWell

University life can bring academic pressure, stress, anxiety, and other emotional challenges. Finding suitable support should be accessible and straightforward.

UWell aims to bring together mental health check-ins, wellbeing resources, counselor discovery, and appointment management in a student-focused mobile experience.

## ✨ Key Features

### 🎓 Student Experience
- 🧠 **Mental Health Check-In** — Record mood check-ins and review wellbeing results.
- 🌱 **Wellness Resources** — Explore mental wellbeing tips and supportive resources.
- 🔎 **Counselor Search** — Discover counselors and their areas of expertise.
- 📅 **Appointment Booking** — Select a counselor and book a counseling session.
- 🔔 **Appointment Information** — View booking confirmations, appointment details, and status.
- 👤 **Profile & Settings** — Access student profile and application settings.

### 🩺 Counselor Experience
- Review and manage counseling appointments.
- Access relevant appointment information.
- Support the counseling workflow for university students.

### 🏫 Student Welfare & University Management
- Provide access to student-support and counseling-service information.
- Present summarized appointment and counseling-service usage information where implemented.

## 🔄 Student Journey

**Welcome → Login/Register → Home → Mood Check-In → Result → Counselor Search → Counselor Details → Availability → Book Appointment → Confirmation → My Appointments**

The workflow is designed to help students move from checking their wellbeing to finding and managing counseling support.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React Native | Mobile application development |
| Expo | Mobile development and testing |
| Node.js | Backend runtime |
| Express.js | REST API development |
| MongoDB | Database |
| Mongoose | Database modeling |
| Axios | Frontend-to-backend communication |
| React Navigation | Application navigation |
| JWT & bcrypt | Authentication and password security, where configured |

## 🏗️ Architecture

UWell uses a client-server architecture:

1. **Mobile frontend** — Displays application screens and manages navigation.
2. **Backend API** — Processes application requests and business logic.
3. **Database** — Stores application and counseling-related data.
4. **API communication** — Connects frontend services with backend endpoints.

## 📁 Project Structure

```text
UWell/
├── frontend/
│   └── src/
│       ├── navigation/
│       ├── screens/
│       └── services/
├── backend/
│   └── src/
├── docs/
├── postman/
└── README.md
```

*This is a simplified overview of the repository structure.*

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- Expo-compatible development environment
- Access to the configured MongoDB database

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

Open a separate terminal from the project root:

```bash
cd backend
npm install
```

### 4. Configure environment variables

Configure the backend and frontend using the project's required environment variables. Use the existing configuration or an `.env.example` file for guidance.

Never commit database credentials, passwords, private keys, or real authentication tokens.

### 5. Start the application

Start the backend using its configured npm script. Then start the Expo frontend from the `frontend` directory:

```bash
npx expo start
```

Ensure the backend URL and database connection are correctly configured before testing.

*Check the relevant `package.json` files for the exact scripts and requirements used by this project.*

## 🧪 Testing

The application can be evaluated through functional and usability testing, including:

- Authentication and form validation.
- Mood check-in submission and result display.
- Counselor search and profile viewing.
- Appointment booking and confirmation.
- Appointment listing and status verification.
- Student navigation and role-specific workflows.

Test outcomes should be documented based on actual test execution.

## 🔐 Privacy & Security

Mental health information is sensitive. The application should use appropriate authentication, access controls, secure credential management, and privacy-conscious data handling.

Do not publish real student wellbeing records, credentials, or sensitive personal information in the repository.

## 🎓 Academic Information

| Item | Details |
|---|---|
| Project | UWell |
| Module | IT3060 – Human-Computer Interaction |
| Project focus | Student mental wellbeing and counseling access |
| Group | WE_5.1_(WE_115) |

## 👥 Contributors

This project is developed collaboratively by the group. Add each member's GitHub profile and contribution below.

- **Student Component** — Student-facing interfaces, mood check-ins, counselor discovery, and appointment workflows.
- **Counselor Component** — Counselor-facing interfaces and appointment management.
- **Student Welfare Component** — Student-support and counseling-service information.
- **University Management Component** — Management dashboard and counseling-service summaries.

*Update these descriptions to match the responsibilities and implemented work of each group member.*

## 🌟 Future Improvements

Potential improvements include enhanced appointment reminders, improved wellbeing-resource discovery, stronger end-to-end testing, and further improvements to the counseling workflow.

## 📄 License

No license has been specified for this project. Add a license if the project owners decide to distribute the source code under specific terms.

---

<p align="center">
  <strong>UWell — Your wellbeing matters. 💜</strong>
</p>
