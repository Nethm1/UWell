# Appointment Jitsi video calls

## How it works

Confirmed online appointments have one Jitsi room name stored on the existing
`appointments` document in `videoRoomName`. The student and assigned counselor
request the link through the same authenticated endpoint; simultaneous or later
requests reuse that room. Counselor appointment mirror IDs (`stu-appt-<id>`) are
resolved to the canonical student appointment after the mirror is checked for
counselor ownership.

The app opens the HTTPS meeting URL with React Native `Linking`, so Jitsi may
open in the device browser or an installed Jitsi app, outside UWell. No native
video SDK or extra Expo Go dependency is needed. The existing in-app live-call
invitation flow remains available for its separate use case.
The browser or Jitsi app handles camera and microphone permission prompts; UWell
cannot inspect or repair permissions granted to that external app. If media
cannot start, allow camera and microphone access there and retry the meeting.

## API

`POST /api/appointments/:appointmentId/video-link`

Send the existing JWT as `Authorization: Bearer <token>`. The route accepts
student or counselor tokens and only issues a link to the student or counselor
recorded on the appointment. The appointment must have status `confirmed`, and
its session type must be `Online`.

Successful response:

```json
{
  "message": "Video meeting ready",
  "meetingUrl": "https://meet.jit.si/uwell-<random-room-id>"
}
```

Errors use `400` for malformed IDs, `401` for missing/invalid login,
`403` for users not assigned to the appointment, `404` for missing records,
`409` for unconfirmed or non-online appointments, and `500` for server/database
failures. The controller returns generic server errors and does not log meeting
URLs or credentials.

## Configuration and startup

The default public Jitsi host is `meet.jit.si`; no Jitsi key or secret is
required. To use a different Jitsi host, set the backend-only optional variable
`JITSI_DOMAIN` to a hostname such as `meet.example.edu`. Do not put credentials
or private keys in the frontend environment.

Start the backend from `backend/` with `npm run dev`. It connects to MongoDB
using the existing `MONGO_URI` and listens on its configured API ports (normally
5000 and 8082). Start the Expo frontend from `frontend/` with `npm run web --
--port 8081` for web, or `npx expo start` for Expo Go. Port 8081 is the frontend;
the backend API and Socket.IO use the separate backend port. The frontend
derives the web API host from the browser URL and the Expo Go API host from the
Expo development host.

For a two-person test, create an online booking, sign in as its counselor and
confirm it, then open the same appointment as each account and tap **Join Video
Call**. Both links should have the same room path.

## Privacy limitation

The backend authorizes who can retrieve the meeting URL. Public Jitsi rooms do
not authenticate participants; anyone who obtains the URL may be able to join.
Do not treat a random room name as access control or use public rooms for
confidential counseling in production without an appropriate Jitsi deployment,
authenticated rooms, participant controls, and a privacy/security review.
