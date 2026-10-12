import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

const messageSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    rollNumber: { type: String, trim: true, uppercase: true, default: '' },
    subject: { type: String, trim: true, default: '' },
    body: { type: String, required: [true, 'Message body is required'], trim: true },
    direction: {
      type: String,
      enum: ['student-to-admin', 'admin-to-student'],
      default: 'student-to-admin',
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'resolved'],
      default: 'unread',
      index: true,
    },
    reply: { type: String, trim: true, default: '' },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.plugin(jsonPlugin);

export const Message = mongoose.model('Message', messageSchema);
