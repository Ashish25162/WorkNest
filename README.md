# WorkNest 🛠️📍

> **On-Demand Doorstep Home Services Platform**  
> Connects customers with certified, nearby service professionals (Electricians, Plumbers, Carpenters, RO Fitters, and more) with real-time map tracking, live routes, and instant dispatch.

---

## 🌟 Key Features

- **🗺️ Interactive Map (100% Free & Open-Source)**:
  - Powered by **Leaflet** & **OpenStreetMap** (CartoDB tiles) — zero proprietary API keys or billing required.
  - Uber-style pulsating blue GPS beacon for live user position.
  - Doorstep location pinning with interactive draggable marker.
  - Multi-tier geolocation (Device GPS with rapid network/IP fallback).

- **🚗 Real-Time Route Navigation (OSRM)**:
  - Computes turn-by-turn driving paths between technician and customer doorstep using Open Source Routing Machine (OSRM).
  - Displays driving arrival ETA and distance metrics.

- **🧭 One-Tap Google Maps Integration**:
  - Direct turn-by-turn driving navigation redirect for field workers (`google.com/maps/dir/?api=1&destination=...`).

- **⚡ Live Technician Marketplace**:
  - Real-time broadcast dispatch for urgent doorstep repairs.
  - Interactive job pins on the map for workers to browse and accept nearby gigs.

- **💬 Real-Time Chat & Booking Cockpit**:
  - Live communication between customer and assigned technician.
  - Status progression: `BROADCAST` ➔ `ACCEPTED` ➔ `EN_ROUTE` ➔ `ACTIVE` ➔ `COMPLETED`.

- **📱 Mobile-First Responsive PWA**:
  - Optimized for mobile viewports, touch gestures, and progressive web app installability.

---

## 🏗️ Architecture & Tech Stack

```
WorkNest/
├── backend/          # Java Spring Boot REST API
│   ├── src/          # Controllers, Services, Models, Repositories
│   ├── pom.xml       # Maven dependencies
│   └── uploads/      # Technician profile photos & assets
│
├── frontend/         # React 18 + Vite PWA
│   ├── src/          # Components, Services, Hooks, Styles
│   ├── public/       # Static assets, PWA manifests
│   └── package.json  # NPM dependencies
│
└── vercel.json       # Production deployment configuration
```

- **Backend**: Java 17+, Spring Boot, Spring Data JPA, RESTful API
- **Frontend**: React 18, Vite, Leaflet, Tailwind CSS, Lucide Icons, Vite PWA
- **Mapping & Geocoding**: OpenStreetMap, Photon (Komoot), Open-Meteo, OSRM Routing

---

## 🚀 Getting Started

### Prerequisites
- **Java 17+**
- **Node.js 18+** & npm

### 1. Start the Backend Server
```bash
cd backend
./mvnw spring-boot:run
```
*The Spring Boot backend will start at `http://localhost:8080`.*

### 2. Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
```
*The Vite application will start at `http://localhost:5173` (or `https://localhost:5173`).*

---

## 📦 Deployment

WorkNest includes preconfigured `vercel.json` for one-click frontend deployment on **Vercel** with automatic API rewrites to your cloud backend (Render / Railway / AWS).

---

## 📄 License
This project is open-source under the MIT License.
