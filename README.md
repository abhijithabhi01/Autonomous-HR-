# 👨‍💼 Autonomous HR Onboarding Agent - Frontend

> Modern React application that automates employee onboarding using AI-powered document verification, onboarding workflows, and HR management.

![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-Frontend-purple)
![Firebase](https://img.shields.io/badge/Firebase-Cloud-orange)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styling-38B2AC)

---

# 📖 Overview

The Autonomous HR Onboarding Agent provides a modern interface for HR teams and employees to complete onboarding digitally.

Users can upload documents, monitor onboarding progress, receive AI-powered verification results, complete checklists, and manage employee information from a single dashboard.

---

# ✨ Features

- 🔐 Secure Login
- 👤 Employee Dashboard
- 📄 Document Upload
- 🤖 AI Document Verification
- 📋 Interactive Checklist
- 📧 Email Notifications
- 👨‍💼 HR Dashboard
- 📊 Employee Progress Tracking
- 📱 Responsive Design
- ⚡ Fast React Interface

---

# 🏗️ Architecture

```
User

 │

 ▼

React + Vite

 │

 ├── Authentication
 ├── Dashboard
 ├── Candidate Portal
 ├── Employee Portal
 ├── Document Upload
 ├── Checklist
 └── Progress Tracking

 │

 ▼

Express Backend

 │

 ▼

Firebase + Google AI
```

---

# ⚙️ Tech Stack

## Frontend

- React 18
- Vite

## State Management

- React Query

## Routing

- React Router

## Forms

- React Hook Form

## File Upload

- React Dropzone

## Date Handling

- date-fns
- React DatePicker

## Icons

- Lucide React

## Backend Communication

- Firebase
- REST APIs

---

# 📂 Project Structure

```
src/

├── assets/
├── components/
│   ├── layout/
│   └── shared/
│
├── hooks/
├── lib/
├── pages/
├── services/
├── App.jsx
└── main.jsx
```

---

# 🚀 Installation

```bash
git clone https://github.com/yourusername/Autonomous-HR.git

cd Autonomous-HR

npm install
```

---

# Environment Variables

Create a `.env` file.

```env
VITE_API_URL=http://localhost:5000

VITE_FIREBASE_API_KEY=

VITE_FIREBASE_PROJECT_ID=

VITE_FIREBASE_AUTH_DOMAIN=
```

---

# Run

Development

```bash
npm run dev
```

Build

```bash
npm run build
```

Preview

```bash
npm run preview
```

---

# Main Pages

- Login
- Dashboard
- Candidate Portal
- Employee Portal
- Document Upload
- Checklist
- Progress Tracker
- HR Dashboard

---

# User Workflow

1. Employee signs in.
2. Upload required documents.
3. AI verifies uploaded documents.
4. Complete onboarding checklist.
5. Receive onboarding status updates.
6. HR reviews employee progress.
7. Employee onboarding is completed.

---

# UI Highlights

- Responsive Layout
- Protected Routes
- Modern Dashboard
- Drag-and-Drop Upload
- Progress Indicators
- Interactive Forms

---

# Security

- Firebase Authentication
- Protected Routes
- Environment Variables
- Secure API Communication

---

# Author

**Abhijith S**

AI Developer | Full Stack Developer

GitHub: https://github.com/abhijithabhi01

LinkedIn: https://www.linkedin.com/in/abhijith-s-5138a724b
