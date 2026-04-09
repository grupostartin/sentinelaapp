# SENTINELA: Tactical Community Security - Design Specification

This document provides a comprehensive overview of the **Sentinela** application for UI/UX design synthesis.

---

## 1. CORE CONCEPT & BRAND IDENTITY
Sentinela (Portuguese for "Sentinel" or "Sentry") is a high-performance community security and neighborhood watch application. It connects residents in real-time to prevent crime and coordinate responses to emergencies.

- **Vibe**: Tactical, Vigilant, Reliable, Professional.
- **Keywords**: Security, Response, Community, Precision, Real-time.
- **Design Metaphor**: Command & Control center in your pocket. Heavy focus on "Tactical Tech" aesthetics.

## 2. DESIGN SYSTEM (Current & Desired)
- **Primary Theme**: Deep Dark Mode (AMOLED Black backgrounds `#000000` to `#0A0A0A`).
- **Accent Color (Primary)**: **"Sentinela Green"** (`#34C759`). Used for connectivity, safety, and operational status.
- **Emergency Color (Tertiary)**: **"Urgency Red"** (`#FF3B30`). Used for Panic buttons, active emergencies, and high-priority alerts.
- **Typography**: Clean Sans-Serif (Inter, Outfit, or Roboto). Headlines should be bold, uppercase, and slightly letter-spaced to evoke a military/technical feel.
- **Aesthetics**: Glassmorphism (subtle), high-contrast borders (1px), micro-animations (pulse effects for status dots).

---

## 3. MAIN INTERFACE MODULES

### A. Home Dashboard (The Pulse)
The primary entry point. Designed for high-stress situations.
- **Panic Button**: A large, central, circular button. Needs "gravity" and tactile feel. Pulse animation when held.
- **Connectivity Status**: A "Sinal Verde" (Green Signal) indicator at the top showing if the user is within their protected neighborhood range.
- **Activity Mural (Recent Events)**: A condensed feed of recent alerts (Panic, Warnings, Suspicious Activity).
    - *Admin View*: Includes a "Selection Mode" to bulk-delete activities. Card highlight changes when selected.

### B. Sala de Crise (The Tactical Hub)
A real-time, high-stakes chat room triggered by an emergency.
- **Operational Badge**: "OPERACIONAL" live badge at the top.
- **Message Alignment**: User messages on the right (matched to profile avatar), neighbor messages on the left.
- **Profile Identification**: Messages display the sender's name and mini-avatar (tactical circle).
- **Status Overlay**: Real-time status indicators (sending, sent, read).

### C. Mural de Observações (Community Feed)
A social bulletin board for low-urgency neighborhood updates.
- **Neighborhood Filter**: A prominent badge showing the current neighborhood (e.g., "RENASCENÇA") with a dropdown to switch.
- **Post Cards**: Each card shows user seniority ("Sentinela há 3 meses"), time, and content.
- **Moderation Tools**: Direct deletion icons for administrators.

### D. User Onboarding & Profile
- **Mandatory Profile Completion**: A streamlined form for address (Street, Number, CEP, Neighborhood), WhatsApp, and profile photo.
- **Tactical Avatar**: Profile photo container with status rings.

---

## 4. KEY INTERACTION PATTERNS
1. **Selection Mode (Admin Mode)**: Toggled by a list icon. UI shifts to show checkboxes on cards and a persistent "Bulk Delete" action bar.
2. **Optimistic UI**: Messages in the chat appear instantly with a "sending" state before being finalized by the server.
3. **Emergency Override**: Active emergency alerts trigger a full-screen, high-urgency modal with haptic feedback (vibration pattern).

## 5. DESIGN GOAL FOR THE AI
Create a layout that feels **Premium and Tactical**. Avoid "social media" cliches; instead, lean into "Security App" paradigms. Every element should look intentional, high-contrast, and optimized for quick scanning in a crisis.

---
*Created for the Sentinela App Development Team.*
