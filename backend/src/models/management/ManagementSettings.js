const mongoose = require('mongoose');

const managementSettingsSchema = new mongoose.Schema(
  {
    // Singleton document — identified by a fixed key
    key: {
      type: String,
      default: 'system',
      unique: true,
      immutable: true,
    },
    dataEncryption: {
      type: Boolean,
      default: true,
    },
    twoFactorAuth: {
      type: Boolean,
      default: true,
    },
    sessionTimeoutMinutes: {
      type: Number,
      default: 30,
      min: [1, 'Session timeout must be at least 1 minute'],
    },
    auditLogging: {
      type: Boolean,
      default: true,
    },
    dataRetentionYears: {
      type: Number,
      default: 5,
      min: [1, 'Data retention must be at least 1 year'],
    },
    privacyMode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

managementSettingsSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

// Build the display-ready settings list consumed by the management UI.
managementSettingsSchema.methods.toSettingsView = function () {
  return [
    {
      id: 1,
      title: 'Data Encryption',
      description: 'All user data is encrypted at rest and in transit',
      status: this.dataEncryption ? 'Enabled' : 'Disabled',
    },
    {
      id: 2,
      title: 'Two-Factor Authentication',
      description: 'Require 2FA for all admin accounts',
      status: this.twoFactorAuth ? 'Enabled' : 'Disabled',
    },
    {
      id: 3,
      title: 'Session Timeout',
      description: 'Auto-logout after inactivity period',
      status: `${this.sessionTimeoutMinutes} minutes`,
    },
    {
      id: 4,
      title: 'Audit Logging',
      description: 'Log all system activities for security review',
      status: this.auditLogging ? 'Enabled' : 'Disabled',
    },
    {
      id: 5,
      title: 'Data Retention Policy',
      description: 'Automatic deletion of old records',
      status: `${this.dataRetentionYears} years`,
    },
    {
      id: 6,
      title: 'Privacy Mode',
      description: 'Hide sensitive information in reports',
      status: this.privacyMode ? 'Enabled' : 'Disabled',
    },
  ];
};

module.exports = mongoose.model('ManagementSettings', managementSettingsSchema);
