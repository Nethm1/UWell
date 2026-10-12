const mongoose = require('mongoose');

const chatItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ['student', 'welfare'], required: true },
    senderName: { type: String, default: '' },
    text: { type: String, required: true },
    isEmergency: { type: Boolean, default: false },
    attachment: {
      name: String,
      url: String,
      type: String,
      size: Number,
    },
    timestamp: { type: String, default: () => new Date().toISOString() },
    read: { type: Boolean, default: false },
  },
  { _id: false }
);

const welfareMessageSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    welfareId: { type: String, required: true, index: true },
    studentName: { type: String, default: 'Student' },
    studentRegNo: { type: String, default: '' },
    studentPhone: { type: String, default: '' },
    studentEmail: { type: String, default: '' },
    studentFaculty: { type: String, default: '' },
    officerName: { type: String, default: 'Welfare Officer' },
    officerStaffId: { type: String, default: '' },
    officerPhone: { type: String, default: '' },
    officerOfficeLocation: { type: String, default: '' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadForOfficer: { type: Number, default: 0 },
    unreadForStudent: { type: Number, default: 0 },
    isEmergency: { type: Boolean, default: false, index: true },
    emergencyAlert: {
      active: { type: Boolean, default: false },
      triggeredAt: { type: Date, default: null },
      message: { type: String, default: '' },
      resolved: { type: Boolean, default: false },
      resolvedAt: { type: Date, default: null },
    },
    chatHistory: { type: [chatItemSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
  }
);

welfareMessageSchema.index({ studentId: 1, welfareId: 1 }, { unique: true });
welfareMessageSchema.index({ welfareId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('WelfareMessage', welfareMessageSchema, 'welfare_messages');
