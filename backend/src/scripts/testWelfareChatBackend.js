const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Welfare = require('../models/welfare/Welfare');
const Student = require('../models/student/Student');
const WelfareMessage = require('../models/welfare/WelfareMessage');
const Notification = require('../models/Notification');

async function runChatTest() {
  console.log('🧪 Starting Welfare Chat & Emergency Backend Test...');
  await connectDB();

  try {
    // 1. Ensure or find a test welfare officer
    let testOfficer = await Welfare.findOne({ staffId: 'WLFTEST01' });
    if (!testOfficer) {
      testOfficer = await Welfare.create({
        staffId: 'WLFTEST01',
        firstName: 'Nalinda',
        lastName: 'Perera',
        email: 'nalinda.welfare.test@uwell.edu',
        department: 'Student Affairs',
        position: 'Senior Welfare Officer',
        phone: '+94 77 123 4567',
        emergencyContactPhone: '+94 77 999 8888',
        officeLocation: 'Welfare Centre Room 101',
        specializations: ['Crisis Intervention', 'Housing', 'Financial Support'],
        officeHours: '8:30 AM - 4:30 PM',
        availabilityStatus: 'Available Today',
        emergencyAvailable: true,
        password: 'Password123#',
        isApproved: true,
        approvalStatus: 'approved',
      });
      console.log('✅ Created test welfare officer:', testOfficer.staffId);
    } else {
      console.log('✅ Found existing test officer:', testOfficer.staffId);
    }

    // 2. Ensure or find a test student
    let testStudent = await Student.findOne({ studentId: 'STUTEST99' });
    if (!testStudent) {
      testStudent = await Student.create({
        studentId: 'STUTEST99',
        firstName: 'Kasun',
        lastName: 'Bandara',
        email: 'kasun.test99@my.sliit.lk',
        phone: '+94 71 555 4321',
        faculty: 'Faculty of Computing',
        degreeProgram: 'Computer Science',
        yearOfStudy: 'Year 2',
        password: 'Password123#',
      });
      console.log('✅ Created test student:', testStudent.studentId);
    } else {
      console.log('✅ Found existing test student:', testStudent.studentId);
    }

    // 3. Test creating a standard conversation
    const studentId = testStudent._id.toString();
    const officerId = testOfficer._id.toString();

    // Clean any previous test conversations
    await WelfareMessage.deleteMany({ studentId, welfareId: officerId });

    const newMsgItem = {
      id: `wm-test-${Date.now()}`,
      senderId: studentId,
      senderRole: 'student',
      senderName: `${testStudent.firstName} ${testStudent.lastName}`,
      text: 'Hello officer, I have a question regarding student welfare bursaries.',
      isEmergency: false,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const conversation = await WelfareMessage.create({
      studentId,
      welfareId: officerId,
      studentName: newMsgItem.senderName,
      studentRegNo: testStudent.studentId,
      studentPhone: testStudent.phone,
      studentEmail: testStudent.email,
      studentFaculty: testStudent.faculty,
      officerName: `${testOfficer.firstName} ${testOfficer.lastName}`,
      officerStaffId: testOfficer.staffId,
      officerPhone: testOfficer.phone,
      officerOfficeLocation: testOfficer.officeLocation,
      lastMessage: newMsgItem.text,
      lastMessageAt: new Date(),
      unreadForOfficer: 1,
      unreadForStudent: 0,
      chatHistory: [newMsgItem],
    });

    console.log('✅ Created welfare conversation:', conversation._id.toString());
    if (conversation.chatHistory.length !== 1 || conversation.unreadForOfficer !== 1) {
      throw new Error('❌ Conversation initialization failed');
    }

    // 4. Test Emergency SOS trigger
    const emergencyMsgItem = {
      id: `wm-test-sos-${Date.now()}`,
      senderId: studentId,
      senderRole: 'student',
      senderName: newMsgItem.senderName,
      text: '🚨 I am having an acute panic attack and need immediate emergency assistance!',
      isEmergency: true,
      timestamp: new Date().toISOString(),
      read: false,
    };

    conversation.chatHistory.push(emergencyMsgItem);
    conversation.lastMessage = '🚨 [EMERGENCY] ' + emergencyMsgItem.text;
    conversation.lastMessageAt = new Date();
    conversation.isEmergency = true;
    conversation.emergencyAlert = {
      active: true,
      triggeredAt: new Date(),
      message: emergencyMsgItem.text,
      resolved: false,
      resolvedAt: null,
    };
    conversation.unreadForOfficer += 1;
    await conversation.save();

    console.log('✅ Emergency SOS recorded in conversation:');
    console.log('   isEmergency:', conversation.isEmergency);
    console.log('   emergencyAlert.active:', conversation.emergencyAlert.active);
    console.log('   lastMessage:', conversation.lastMessage);

    // 5. Test Officer Reply
    const officerReply = {
      id: `wm-test-rep-${Date.now()}`,
      senderId: officerId,
      senderRole: 'welfare',
      senderName: conversation.officerName,
      text: 'Kasun, take deep breaths. I am in Room 101 right now. I am also calling you on your phone immediately.',
      isEmergency: false,
      timestamp: new Date().toISOString(),
      read: false,
    };
    conversation.chatHistory.push(officerReply);
    conversation.lastMessage = officerReply.text;
    conversation.unreadForStudent = 1;
    await conversation.save();

    console.log('✅ Officer reply recorded in conversation:');
    console.log('   Total messages:', conversation.chatHistory.length);

    // 6. Test Resolving Emergency Alert
    conversation.isEmergency = false;
    conversation.emergencyAlert.active = false;
    conversation.emergencyAlert.resolved = true;
    conversation.emergencyAlert.resolvedAt = new Date();
    await conversation.save();

    console.log('✅ Emergency alert resolved:');
    console.log('   isEmergency:', conversation.isEmergency);
    console.log('   emergencyAlert.resolved:', conversation.emergencyAlert.resolved);

    // 7. Cleanup test records
    await WelfareMessage.deleteMany({ studentId, welfareId: officerId });
    await Welfare.deleteOne({ staffId: 'WLFTEST01' });
    await Student.deleteOne({ studentId: 'STUTEST99' });
    console.log('✅ Test cleanup completed successfully.');

    console.log('\n🎉 ALL BACKEND CHAT & EMERGENCY TESTS PASSED!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runChatTest();
