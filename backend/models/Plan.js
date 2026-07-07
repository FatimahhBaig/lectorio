const mongoose = require("mongoose");

const quizQuestionSchema = new mongoose.Schema(
  {
    question: String,
    options: {
      type: [String],
      default: []
    },
    answer: String
  },
  { _id: false }
);

const topicSectionSchema = new mongoose.Schema(
  {
    heading: String,
    content: String
  },
  { _id: false }
);

const topicLessonSchema = new mongoose.Schema(
  {
    topic: String,
    easyExplanation: String,
    sections: {
      type: [topicSectionSchema],
      default: []
    },
    examples: {
      type: [String],
      default: []
    },
    keyPoints: {
      type: [String],
      default: []
    },
    quiz: {
      type: [quizQuestionSchema],
      default: []
    },
    generatedAt: Date
  },
  { _id: false }
);

const videoRecommendationSchema = new mongoose.Schema(
  {
    title: String,
    channel: {
      type: String,
      default: ""
    },
    reason: String,
    url: String,
    thumbnail: {
      type: String,
      default: ""
    },
    duration: {
      type: String,
      default: ""
    },
    youtubeUrl: {
      type: String,
      default: ""
    },
    videoId: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const generatedDaySchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true
    },

    title: {
      type: String,
      required: true
    },

    summary: {
      type: String,
      required: true
    },

    explanation: {
      type: String,
      default: ""
    },

    keyPoints: {
      type: [String],
      default: []
    },

    topics: {
      type: [String],
      default: []
    },

    estimatedMinutes: {
      type: Number,
      default: 0
    },

    isRevisionDay: {
      type: Boolean,
      default: false
    },

    tasks: {
      type: [String],
      default: []
    },

    quiz: {
      type: [String],
      default: []
    },

    revisionSummary: {
      type: String,
      default: ""
    },

    completionQuiz: {
      type: [quizQuestionSchema],
      default: []
    },

    videoRecommendations: {
      type: [videoRecommendationSchema],
      default: []
    },

    videoRecommendationsGeneratedAt: Date,

    completedAt: Date
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    title: String,
    fileName: String,
    notes: String,

    days: Number,
    studyTime: Number,
    breakTime: Number,

    wordCount: Number,
    estimatedStudyMinutes: Number,

    requestedDays: Number,
    recommendedDays: Number,

    mainTopics: {
      type: [String],
      default: []
    },

    revisionDayAdded: {
      type: Boolean,
      default: false
    },

    dashboardSuggestion: {
      type: String,
      default: ""
    },

    generatedPlan: {
      type: [generatedDaySchema],
      default: []
    },

    completedDays: {
      type: [Number],
      default: []
    },

    topicLessons: {
      type: [topicLessonSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
