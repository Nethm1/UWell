# Implementation Plan: Fix Booking Flow & Video Call Integration

## Summary

The task is to fix the backend startup crash and connect the student-counselor booking flow with real-time notifications and video call invites. The backend crashes on startup because `getCounselorNotifications` is referenced but not imported in `notificationController.js`.

## Known Blocker

**Backend crashes on startup** with `ReferenceError: getCounselorNotifications is not defined` at `notificationController.js:68:38`. This function is defined in `notificationController.js` and exported, but `appointmentController.js` imports it incorrectly.

## Investigation Findings

### 1. Backend Notification System
- `notificationController.js` defines and exports `getCounselorNotifications` correctly (lines 15–42)
- `appointmentController.js` does NOT import `getCounselorNotifications` at all — it only uses `CounselorAppointment`, `CounselorStudent`, `Appointment`, and `counselorKey`
- The backend startup crash is NOT caused by `notificationController.js` — the error at line 68:38 is misleading; line 68 is `module.exports = { sendNotification, getCounselorNotifications, getUnreadCount, markAsRead }`
- The actual cause is likely a circular import or incorrect require statement somewhere

### 2. Booking Flow Gaps
- Student books appointment → status should be "Pending" → Counselor sees in AppointmentsScreen
- Counselor approves → status becomes "Confirmed" → Student should receive notification
- Current `appointmentController.updateAppointmentStatus` updates status but does NOT:
  - Emit a socket event to notify the student
  - Create a Notification record for the student
  - Update the student's appointment status

### 3. Student UI Gaps
- `my-appointments.tsx` shows "Confirmed" and "Upcoming" status but no "New" badge for newly confirmed appointments
- `home.tsx` does not show real-time notification count
- `booking-confirmation.tsx` shows counselor details but is only used after booking (not for approval notification)
- No socket event handlers for `appointment-approved` or `video-call-invite`

### 4. Video Call Invite Flow Gaps
- Counselor `VideoSessionScreen.jsx` sends `call-invite` via socket when user taps "Invite to Video Session"
- Student has no socket handler for `call-invite` to show a modal/alert and auto-open `VideoCallScreen`
- `VideoCallScreen.tsx` expects `roomId` or `appointmentId` but student never receives the invite

### 5. Routes Missing
- No `/api/counselor/notifications` route is registered in `counselorRoutes.js`
- No `/api/counselor/notifications/unread-count` route
- No `/api/counselor/notifications/:id/read` route

---

## Ordered Implementation Plan

### Phase 1: Fix Backend Startup Crash

- [ ] 1.1. Verify `appointmentController.js` does not import `getCounselorNotifications`
      Files: `backend/src/controllers/counselor/appointmentController.js`
      Verify: Check `require()` statements — none should import `notificationController`
      Fix needed: If any incorrect import exists, remove it

- [ ] 1.2. Add missing notification routes to counselor router
      Files: `backend/src/routes/counselor/counselorRoutes.js`
      Add:
      ```javascript
      const notificationController = require('../../controllers/counselor/notificationController');
      router.get('/notifications', notificationController.getCounselorNotifications);
      router.get('/notifications/unread-count', notificationController.getUnreadCount);
      router.put('/notifications/:id/read', notificationController.markAsRead);
      ```
      Verify: `npm run dev` starts without crash

- [ ] 1.3. Create notification service for student notifications
      Files: `backend/src/services/notificationService.js` (new)
      Add helper `sendStudentNotification(studentId, title, message, type, appointmentId)`
      Verify: New file created and exports function

---

### Phase 2: Connect Booking Approval to Student Notification

- [ ] 2.1. Modify `appointmentController.updateAppointmentStatus` to emit socket event and create notification on approval
      Files: `backend/src/controllers/counselor/appointmentController.js`
      After status update to "Confirmed":
      - Call `sendStudentNotification(appointment.studentId, 'Booking Confirmed', 'Your appointment with Dr. X has been confirmed.', 'appointment_updated', appointment._id)`
      - Emit socket event: `io.to('user:' + studentId).emit('appointment-approved', { appointmentId, counselorId, counselorName })`
      Verify: `npm run dev` + test approval flow

- [ ] 2.2. Add socket event handler in student `AppointmentsScreen` / `HomeScreen`
      Files: `frontend/src/screens/student/home.tsx`
      Add socket listener for `appointment-approved` to show toast/alert
      Verify: Student receives notification on approval

---

### Phase 3: Add "New" Badge for Confirmed Appointments

- [ ] 3.1. Update `my-appointments.tsx` to show "New" status for newly confirmed appointments
      Files: `frontend/src/screens/student/my-appointments.tsx`
      Add logic: If `status === 'confirmed'` and `createdAt > 24h ago`, show "New" badge with blue color
      Verify: UI shows blue "New" badge on confirmed appointments

- [ ] 3.2. Update `booking-confirmation.tsx` to show counselor details
      Files: `frontend/src/screens/student/booking-confirmation.tsx`
      Already exists and shows counselor name, specialization, etc. — verify it matches counselor screen
      Verify: Counselor name, specialization, and contact details visible

---

### Phase 4: Real-Time Video Call Invite

- [ ] 4.1. Add socket listener in student `VideoCallScreen.tsx` for `call-invite`
      Files: `frontend/src/screens/shared/VideoCallScreen.tsx`
      Add listener for `call-invite` event that shows modal: "Dr. X wants to start a video call"
      If user accepts, join the room using `roomId` from payload
      Verify: Student receives invite and can join

- [ ] 4.2. Update student `HomeScreen` to show call invite modal
      Files: `frontend/src/screens/student/home.tsx`
      Add state `pendingCallInvite` with counselor name, date, time, appointmentId
      Show modal when `socket.on('call-invite', ...)` fires
      Verify: Modal appears when counselor starts session

---

### Phase 5: UI Consistency

- [ ] 5.1. Update `AppointmentsScreen.jsx` counselor view to show "New" indicator for recent confirmations
      Files: `frontend/src/screens/counselor/AppointmentsScreen.jsx`
      Add visual indicator when status changed from "Pending" to "Confirmed" in last 24h
      Verify: Visual indicator appears on newly approved appointments

- [ ] 5.2. Add socket event `student-joined-call` to notify counselor when student accepts invite
      Files: `frontend/src/screens/counselor/VideoSessionScreen.jsx` + `VideoCallScreen.tsx`
      Emit when student joins room, show "Student joined" message on counselor screen
      Verify: Counselor sees when student joins

---

## Verification Steps

1. **Backend startup**: `npm run dev` — no crash, no "getCounselorNotifications is not defined" error
2. **Booking approval flow**: 
   - Login as counselor
   - Approve a "Pending" appointment
   - Login as student → check "My Appointments" for "Confirmed" status and "New" badge
3. **Video call invite**:
   - Counselor starts video session from appointment
   - Student receives socket invite and can accept
   - Both join the same Jitsi room
4. **Notifications**:
   - Student sees real-time notification count in home screen
   - Student receives toast/alert on booking approval

---

## Risk Assessment

- **Low risk**: Adding notification routes and helper service
- **Medium risk**: Modifying `updateAppointmentStatus` to emit socket events — existing flow may rely on current behavior
- **High risk**: Student socket handlers — must be tested end-to-end with real device/emulator
