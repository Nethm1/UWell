const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');
const Welfare = require('../models/welfare/Welfare');
const Student = require('../models/student/Student');
const WelfareMessage = require('../models/welfare/WelfareMessage');
const Notification = require('../models/Notification');

// Import socket.io-client from frontend node_modules or fallback
let ioClient;
try {
  ioClient = require('socket.io-client');
} catch (e) {
  ioClient = require(path.resolve(__dirname, '../../../frontend/node_modules/socket.io-client'));
}

const API_BASE = 'http://127.0.0.1:5000/api';
const SOCKET_BASE = 'http://127.0.0.1:8082';
const JWT_SECRET = process.env.JWT_SECRET || 'uwell_super_secret_change_this_in_production_2026';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log('===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE E2E VERIFICATION TEST');
  console.log('   Module: Welfare Officer & Student Direct Messaging & SOS');
  console.log('===============================================================\n');

  await connectDB();

  let testOfficer = null;
  let testStudent = null;
  let studentSocket = null;
  let officerSocket = null;
  let studentToken = '';
  let officerToken = '';
  let conversationId = '';

  try {
    // -------------------------------------------------------------------------
    // STEP 0: Clean up and Setup Test Entities
    // -------------------------------------------------------------------------
    console.log('▶ [0/9] Setting up isolated test records in MongoDB...');

    await Welfare.deleteMany({ staffId: 'WLFTEST99' });
    await Student.deleteMany({ studentId: 'STUTEST99' });

    testOfficer = await Welfare.create({
      staffId: 'WLFTEST99',
      firstName: 'Priyantha',
      lastName: 'Dissanayake',
      email: 'priyantha.e2e@uwell.edu',
      department: 'Student Support Services',
      position: 'Senior Campus Welfare Officer',
      phone: '+94 77 345 6789',
      emergencyContactPhone: '+94 77 911 0000',
      officeLocation: 'Student Hub Bldg B, Room 204',
      specializations: ['Emergency Triage', 'Crisis De-escalation', 'Student Bursaries'],
      officeHours: '8:00 AM - 4:00 PM',
      availabilityStatus: 'Available Today',
      emergencyAvailable: true,
      workingSchedule: 'Full-time On Campus',
      consultationMode: 'In-Person & Online',
      password: 'Password123#',
      isApproved: true,
      approvalStatus: 'approved',
    });

    testStudent = await Student.create({
      studentId: 'STUTEST99',
      firstName: 'Chamika',
      lastName: 'Senaratne',
      email: 'chamika.e2e@my.sliit.lk',
      phone: '+94 71 888 9999',
      faculty: 'Faculty of Computing',
      degreeProgram: 'Computer Science',
      yearOfStudy: 'Year 3',
      password: 'Password123#',
    });

    studentToken = jwt.sign({ id: testStudent._id.toString(), role: 'student' }, JWT_SECRET, { expiresIn: '1d' });
    officerToken = jwt.sign({ id: testOfficer._id.toString(), role: 'welfare' }, JWT_SECRET, { expiresIn: '1d' });

    console.log(`   ✅ Test Officer ready: ${testOfficer.firstName} ${testOfficer.lastName} (ID: ${testOfficer._id})`);
    console.log(`   ✅ Test Student ready: ${testStudent.firstName} ${testStudent.lastName} (ID: ${testStudent._id})`);

    // -------------------------------------------------------------------------
    // STEP 1: Student Welfare Directory Discovery (GET /api/welfare-chat/officers)
    // -------------------------------------------------------------------------
    console.log('\n▶ [1/9] Testing Student Officer Discovery API...');
    const dirRes = await fetch(`${API_BASE}/welfare-chat/officers`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!dirRes.ok) throw new Error(`Discovery failed with status ${dirRes.status}`);
    const dirData = await dirRes.json();

    if (!dirData.success || !Array.isArray(dirData.officers)) {
      throw new Error('Discovery response payload invalid');
    }

    const matchedOfficer = dirData.officers.find((o) => o.staffId === 'WLFTEST99');
    if (!matchedOfficer) throw new Error('Test officer not found in directory');
    if (matchedOfficer.emergencyAvailable !== true) throw new Error('Officer emergencyAvailable flag is false');
    if (!matchedOfficer.emergencyContactPhone) throw new Error('Officer emergency contact phone missing');

    console.log(`   ✅ Discovery passed. Found ${dirData.officers.length} officers. Matched: "${matchedOfficer.name}"`);
    console.log(`      Location: ${matchedOfficer.officeLocation} | Hotline: ${matchedOfficer.emergencyContactPhone}`);

    // -------------------------------------------------------------------------
    // STEP 2: Officer Profile Details (GET /api/welfare-chat/officer/:id)
    // -------------------------------------------------------------------------
    console.log('\n▶ [2/9] Testing Officer Profile Details API...');
    const profRes = await fetch(`${API_BASE}/welfare-chat/officer/${testOfficer._id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!profRes.ok) throw new Error(`Officer profile failed with status ${profRes.status}`);
    const profData = await profRes.json();
    if (!profData.success || !profData.officer) throw new Error('Officer profile payload invalid');
    console.log(`   ✅ Officer Profile retrieved: ${profData.officer.name} (${profData.officer.department})`);

    // -------------------------------------------------------------------------
    // STEP 3: Real-Time Socket Connection & Registration
    // -------------------------------------------------------------------------
    console.log('\n▶ [3/9] Establishing Real-Time Socket.io Connections...');

    studentSocket = ioClient(SOCKET_BASE, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });
    officerSocket = ioClient(SOCKET_BASE, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    await Promise.all([
      new Promise((res, rej) => {
        studentSocket.on('connect', () => {
          studentSocket.emit('register-user', { userId: testStudent._id.toString(), role: 'student' });
          res();
        });
        studentSocket.on('connect_error', rej);
      }),
      new Promise((res, rej) => {
        officerSocket.on('connect', () => {
          officerSocket.emit('register-user', { userId: testOfficer._id.toString(), role: 'welfare' });
          res();
        });
        officerSocket.on('connect_error', rej);
      }),
    ]);

    console.log(`   ✅ Student Socket connected: ${studentSocket.id} (user:${testStudent._id})`);
    console.log(`   ✅ Officer Socket connected: ${officerSocket.id} (user:${testOfficer._id})`);

    // -------------------------------------------------------------------------
    // STEP 4: Student Sends Standard Message (HTTP POST + Socket Real-time push)
    // -------------------------------------------------------------------------
    console.log('\n▶ [4/9] Testing Normal Student Message & Real-Time Socket Delivery...');

    const receivedByOfficerPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for welfare:new-message on officer socket')), 5000);
      officerSocket.on('welfare:new-message', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const sendMsgRes = await fetch(`${API_BASE}/welfare-chat/message/${testOfficer._id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        text: 'Hello Mr. Priyantha, I would like to inquire about university welfare funds.',
        isEmergency: false,
      }),
    });

    if (!sendMsgRes.ok) throw new Error(`Send message failed with status ${sendMsgRes.status}`);
    const sendMsgData = await sendMsgRes.json();
    if (!sendMsgData.success) throw new Error('Send message API unsuccessful');
    conversationId = sendMsgData.conversationId;

    console.log(`   ✅ HTTP message dispatched. Conversation ID: ${conversationId}`);

    const socketDeliveredMsg = await receivedByOfficerPromise;
    console.log(`   ✅ Officer socket received real-time push: "${socketDeliveredMsg.message.text}"`);
    if (socketDeliveredMsg.unreadCount !== 1) throw new Error('Unread count on officer socket not 1');
    if (socketDeliveredMsg.isEmergency) throw new Error('Normal message should not be emergency');

    // -------------------------------------------------------------------------
    // STEP 5: Real-Time Typing Indicator Relay
    // -------------------------------------------------------------------------
    console.log('\n▶ [5/9] Testing Socket Typing Indicator Relay...');

    const typingPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for typing event')), 4000);
      officerSocket.on('welfare:typing', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    studentSocket.emit('welfare:typing', {
      recipientId: testOfficer._id.toString(),
      isTyping: true,
      conversationId,
    });

    const typingReceived = await typingPromise;
    if (!typingReceived.isTyping) throw new Error('Typing indicator flag was false');
    console.log(`   ✅ Typing event relayed: sender ${typingReceived.senderId} isTyping: ${typingReceived.isTyping}`);

    // -------------------------------------------------------------------------
    // STEP 6: Officer Replies & Student In-App Notification Delivery
    // -------------------------------------------------------------------------
    console.log('\n▶ [6/9] Testing Officer Reply & Push Notification Delivery...');

    const receivedByStudentPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for officer reply on student socket')), 5000);
      studentSocket.on('welfare:new-message', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const replyRes = await fetch(`${API_BASE}/welfare-chat/message/${testStudent._id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        text: 'Hello Chamika, you can visit Room 204 tomorrow at 10 AM with your student ID.',
        isEmergency: false,
      }),
    });

    if (!replyRes.ok) throw new Error(`Officer reply failed with status ${replyRes.status}`);
    const replyData = await replyRes.json();
    if (!replyData.success) throw new Error('Officer reply API unsuccessful');

    const studentReceivedMsg = await receivedByStudentPromise;
    console.log(`   ✅ Student socket received officer reply: "${studentReceivedMsg.message.text}"`);

    // Verify Notification document in MongoDB
    const studentNotif = await Notification.findOne({
      recipientId: testStudent._id.toString(),
      recipientType: 'student',
      type: 'welfare_message',
    });
    if (!studentNotif) throw new Error('Notification record not created for student');
    console.log(`   ✅ In-App Push Notification record created for student: "${studentNotif.title}"`);

    // -------------------------------------------------------------------------
    // STEP 7: Emergency SOS Trigger (Student -> Officer)
    // -------------------------------------------------------------------------
    console.log('\n▶ [7/9] Testing Emergency SOS Trigger, Crisis Broadcast & Push Alert...');

    const emergencySosPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for welfare:emergency-sos on officer socket')), 5000);
      officerSocket.on('welfare:emergency-sos', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const sosRes = await fetch(`${API_BASE}/welfare-chat/message/${testOfficer._id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        text: '🚨 CRITICAL SOS: I am having a severe psychological panic crisis near the library!',
        isEmergency: true,
      }),
    });

    if (!sosRes.ok) throw new Error(`SOS message failed with status ${sosRes.status}`);
    const sosData = await sosRes.json();
    if (!sosData.success || !sosData.isEmergency) throw new Error('SOS trigger response failed isEmergency flag');

    const emergencyPayload = await emergencySosPromise;
    console.log('   ✅ Officer socket received 🚨 welfare:emergency-sos alert:');
    console.log(`      Student: ${emergencyPayload.studentName} (${emergencyPayload.studentRegNo})`);
    console.log(`      Phone: ${emergencyPayload.studentPhone} | Faculty: ${emergencyPayload.studentFaculty}`);
    console.log(`      Message: "${emergencyPayload.message}"`);

    // Verify Officer Emergency SOS Notification in DB
    const officerSosNotif = await Notification.findOne({
      recipientId: testOfficer._id.toString(),
      recipientType: 'welfare',
      type: 'emergency_sos',
    });
    if (!officerSosNotif) throw new Error('Emergency SOS Notification document missing in MongoDB');
    console.log(`   ✅ Officer System Notification recorded: "${officerSosNotif.title}"`);

    // Verify DB WelfareMessage state
    const convDb = await WelfareMessage.findById(conversationId);
    if (!convDb.isEmergency || !convDb.emergencyAlert?.active) {
      throw new Error('Conversation emergency state is not active in MongoDB');
    }
    console.log('   ✅ Conversation DB state: isEmergency=true, emergencyAlert.active=true');

    // -------------------------------------------------------------------------
    // STEP 8: Officer Inbox Filtering (Emergency & Unread Tabs)
    // -------------------------------------------------------------------------
    console.log('\n▶ [8/9] Testing Officer Inbox Filtering (Emergency Tab)...');

    const inboxSosRes = await fetch(`${API_BASE}/welfare-chat/inbox?filter=emergency`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    if (!inboxSosRes.ok) throw new Error(`Inbox emergency query failed with status ${inboxSosRes.status}`);
    const inboxSosData = await inboxSosRes.json();
    if (inboxSosData.emergencyCount < 1) throw new Error('Emergency count is 0 in inbox');
    const filteredConv = inboxSosData.conversations.find((c) => c.id === conversationId);
    if (!filteredConv) throw new Error('Active emergency conversation not in emergency inbox tab');
    console.log(`   ✅ Emergency Inbox filter working: ${inboxSosData.emergencyCount} crisis conversation(s) found`);

    // -------------------------------------------------------------------------
    // STEP 9: Emergency Resolution Flow (Officer Resolves Alert)
    // -------------------------------------------------------------------------
    console.log('\n▶ [9/9] Testing Emergency Resolution & Real-Time Sync...');

    const resolvedOnStudentPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for welfare:emergency-resolved on student socket')), 5000);
      studentSocket.on('welfare:emergency-resolved', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const resolveRes = await fetch(`${API_BASE}/welfare-chat/emergency/resolve/${conversationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        resolutionNotes: 'Contacted student phone, verified student is safe in welfare centre.',
      }),
    });

    if (!resolveRes.ok) throw new Error(`Resolve failed with status ${resolveRes.status}`);
    const resolveData = await resolveRes.json();
    if (!resolveData.success) throw new Error('Resolve API failed');

    const studentResolvedEvent = await resolvedOnStudentPromise;
    console.log(`   ✅ Student received real-time welfare:emergency-resolved for conversation ${studentResolvedEvent.conversationId}`);

    // Verify DB State after resolution
    const resolvedDb = await WelfareMessage.findById(conversationId);
    if (resolvedDb.isEmergency !== false || resolvedDb.emergencyAlert.active !== false || resolvedDb.emergencyAlert.resolved !== true) {
      throw new Error('Conversation emergency state was not cleared after resolution');
    }
    console.log('   ✅ Conversation DB state resolved: isEmergency=false, active=false, resolved=true');

    // -------------------------------------------------------------------------
    // ALL TESTS SUCCEEDED
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🎉 ALL 9 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('   ✔ Officer discovery & profile fetching');
    console.log('   ✔ Real-time Socket.io handshake & user registration');
    console.log('   ✔ Student message sending & real-time delivery');
    console.log('   ✔ Real-time typing indicator relay');
    console.log('   ✔ Officer reply & Student push notification creation');
    console.log('   ✔ Emergency SOS trigger & immediate crisis alarm socket emission');
    console.log('   ✔ Push/In-App SOS Notification dispatch to officer');
    console.log('   ✔ Officer inbox emergency filter & unread counters');
    console.log('   ✔ Officer resolution flow & real-time de-escalation event');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('\n❌ E2E EXECUTION FAILED WITH ERROR:', error);
    throw error;
  } finally {
    // Clean up connections & test data
    console.log('🧹 Cleaning up test artifacts...');
    if (studentSocket) studentSocket.disconnect();
    if (officerSocket) officerSocket.disconnect();

    if (conversationId) {
      await WelfareMessage.deleteMany({ _id: conversationId });
    }
    if (testOfficer?._id) {
      await Welfare.deleteMany({ staffId: 'WLFTEST99' });
      await Notification.deleteMany({ recipientId: testOfficer._id.toString() });
    }
    if (testStudent?._id) {
      await Student.deleteMany({ studentId: 'STUTEST99' });
      await Notification.deleteMany({ recipientId: testStudent._id.toString() });
    }
    console.log('   ✅ Database cleaned up.');
    await mongoose.disconnect();
  }
}

runE2ETest().then(() => {
  console.log('🎉 Done.');
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Process exiting with error:', err.message);
  process.exit(1);
});
