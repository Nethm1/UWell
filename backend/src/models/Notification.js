const mongoose = require('mongoose');

/**
 * Notification model – stores push/in-app notifications for students,
 * counselors, and welfare officers.
 *
 * recipientType: 'student' | 'counselor' | 'welfare'
 * recipientId  : ObjectId reference to the relevant user document
 */
const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    recipientType: {
      type: String,
      enum: ['student', 'counselor', 'welfare'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: 'general',
    },
    appointmentId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : '';
        ret.unread = !ret.isRead;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);

