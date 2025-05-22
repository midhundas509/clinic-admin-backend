const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  tokenNumber: {
    type: Number,
    required: [true, 'Token number is required'],
    unique: true
  },
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
    minlength: [3, 'Patient name must be at least 3 characters'],
    maxlength: [50, 'Patient name cannot exceed 50 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\d\+\-\(\) ]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['waiting', 'serving', 'completed', 'skipped', 'canceled'],
    default: 'waiting'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to generate token number
tokenSchema.statics.generateTokenNumber = async function() {
  try {
    const lastToken = await this.findOne().sort('-tokenNumber');
    return lastToken ? lastToken.tokenNumber + 1 : 1;
  } catch (err) {
    console.error('Error generating token number:', err);
    return Math.floor(Date.now() / 1000) % 100000; // Fallback
  }
};

// Modified pre-save hook
tokenSchema.pre('validate', async function(next) {
  if (!this.isNew || this.tokenNumber) return next();
  
  try {
    this.tokenNumber = await this.constructor.generateTokenNumber();
    console.log('Generated token number:', this.tokenNumber);
    next();
  } catch (err) {
    console.error('Pre-validate hook error:', err);
    next(err);
  }
});

module.exports = mongoose.model('Token', tokenSchema);