const express = require("express");
const axios = require("axios");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

const Plan = require("../models/Plan");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

function cleanAIJson(aiText) {
  return aiText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

async function callOpenRouter(messages) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openrouter/auto",
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 90000
    }
  );

  const aiText = response.data?.choices?.[0]?.message?.content;

  if (typeof aiText !== "string") {
    throw new Error("AI returned an empty response");
  }

  return JSON.parse(cleanAIJson(aiText));
}

function validateGeneratedPlan(generatedPlan, days, studyTime) {
  if (!Array.isArray(generatedPlan) || generatedPlan.length !== days) {
    throw new Error(`AI must return exactly ${days} study days`);
  }

  return generatedPlan.map((studyDay, index) => {
    if (
      !studyDay ||
      typeof studyDay.title !== "string" ||
      typeof studyDay.summary !== "string" ||
      typeof studyDay.explanation !== "string" ||
      !Array.isArray(studyDay.keyPoints) ||
      !Array.isArray(studyDay.topics) ||
      !Array.isArray(studyDay.tasks) ||
      !Array.isArray(studyDay.quiz)
    ) {
      throw new Error("AI returned an invalid study-day structure");
    }

    const estimatedMinutes = Number(studyDay.estimatedMinutes);

    return {
      day: index + 1,

      title: studyDay.title.trim(),

      summary: studyDay.summary.trim(),

      explanation: studyDay.explanation.trim(),

      keyPoints: studyDay.keyPoints
        .map(String)
        .map(point => point.trim())
        .filter(Boolean),

      topics: studyDay.topics
        .map(String)
        .map(topic => topic.trim())
        .filter(Boolean),

      estimatedMinutes:
        Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
          ? Math.min(estimatedMinutes, studyTime)
          : studyTime,

      isRevisionDay: Boolean(studyDay.isRevisionDay),

      tasks: studyDay.tasks
        .map(String)
        .map(task => task.trim())
        .filter(Boolean),

      quiz: studyDay.quiz
        .map(String)
        .map(question => question.trim())
        .filter(Boolean)
    };
  });
}

function buildYouTubeSearchUrl(query) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
}

function normalizeVideoRecommendations(rawRecommendations, studyDay, planTitle) {
  if (!Array.isArray(rawRecommendations)) return [];

  return rawRecommendations
    .slice(0, 5)
    .map(recommendation => {
      const title = String(recommendation.title || "").trim();
      const channel = String(recommendation.channel || "").trim();
      const reason = String(recommendation.reason || "").trim();
      const query = String(
        recommendation.searchQuery ||
          [title, channel, studyDay.topics.join(" "), planTitle, "lecture tutorial"]
            .filter(Boolean)
            .join(" ")
      ).trim();
      const directUrl = String(recommendation.url || "").trim();
      const safeUrl = directUrl.startsWith("https://www.youtube.com/") ||
        directUrl.startsWith("https://youtu.be/")
          ? directUrl
          : buildYouTubeSearchUrl(query || title || studyDay.title);

      return {
        title,
        channel,
        reason,
        url: safeUrl
      };
    })
    .filter(recommendation => recommendation.title && recommendation.reason)
    .slice(0, 5);
}

async function generateVideoRecommendationsForDay(plan, studyDay) {
  const parsedData = await callOpenRouter([
    {
      role: "system",
      content:
        "You recommend high-quality YouTube learning videos for students. Return valid JSON only. Do not invent exact video URLs unless you are highly confident; prefer search queries."
    },
    {
      role: "user",
      content: `
Recommend 3 to 5 highly relevant YouTube learning videos for this study day.

PLAN TITLE:
${plan.title}

STUDY DAY:
Day ${studyDay.day}: ${studyDay.title}

DAY TOPICS:
${studyDay.topics.join(", ")}

DAY SUMMARY:
${studyDay.summary}

DAY EXPLANATION:
${studyDay.explanation}

KEY POINTS:
${studyDay.keyPoints.join(" | ")}

LECTURE CONTEXT:
${plan.notes.slice(0, 12000)}

Return valid JSON only using exactly this structure:
{
  "recommendations": [
    {
      "title": "Likely YouTube video title or precise search title",
      "channel": "Channel name if known, otherwise empty string",
      "reason": "Short reason this helps with the day's topics",
      "searchQuery": "Specific YouTube search query for this recommendation",
      "url": ""
    }
  ]
}

Rules:
- Recommend videos that teach the day's topics, not generic productivity content.
- Include 3 to 5 recommendations.
- Keep reasons under 22 words.
- Use the lecture topics to guide relevance.
- If unsure about an exact URL, leave url empty and provide a strong YouTube search query.
`
    }
  ]);

  const recommendations = normalizeVideoRecommendations(
    parsedData.recommendations,
    studyDay,
    plan.title
  );

  if (recommendations.length < 3) {
    throw new Error("AI returned too few video recommendations");
  }

  return recommendations;
}

async function extractPdfText(fileBuffer) {
  const parser = new PDFParse({
    data: fileBuffer
  });

  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function generateStudyPlan({
  lectureText,
  days,
  studyTime,
  breakTime
}) {
  const prompt = `
Create a balanced day-by-day study plan from the lecture notes below.

STUDY SETTINGS:
- Number of study days: ${days}
- Maximum study time per day: ${studyTime} minutes
- Break time: ${breakTime} minutes

LECTURE NOTES:
${lectureText.slice(0, 60000)}

First identify the important topics in the lecture.

Then distribute those topics across exactly ${days} study days.

BALANCING RULES:
- Keep related topics together.
- Do not divide content only by word count.
- Make each day's workload as balanced as possible.
- Each day should take approximately ${studyTime} minutes or less.
- Do not split a topic across multiple days unless it is very large.
- Do not repeat the same topic on different days.
- Use extra time on lighter days for revision and active recall.
- The final day may include review, but it must still cover lecture content.

Return valid JSON only.
Do not include markdown or code blocks.

Use exactly this structure:

{
  "mainTopics": ["Main topic 1", "Main topic 2"],
  "dashboardSuggestion": "A short encouraging suggestion for starting this plan",
  "generatedPlan": [
    {
      "day": 1,
      "title": "Short title for this study day",
      "summary": "Simple explanation of what will be studied",
      "explanation": "Student-friendly explanation based only on the lecture notes",
      "keyPoints": ["Important point 1", "Important point 2"],
      "topics": [
        "Topic 1",
        "Topic 2"
      ],
      "estimatedMinutes": ${studyTime},
      "isRevisionDay": false,
      "tasks": [
        "Specific study task 1",
        "Specific study task 2",
        "Specific study task 3"
      ],
      "quiz": [
        "Question 1",
        "Question 2"
      ]
    }
  ]
}

REQUIREMENTS:
- Return exactly ${days} day objects.
- Include at least one topic per day.
- Include a simple explanation and at least three key points per day.
- Include at least three useful tasks per day.
- Include at least two quiz questions per day.
- estimatedMinutes must not exceed ${studyTime}.
- If the schedule has spare capacity, make the final day a revision day and set isRevisionDay to true.
- Use only facts and topics contained in the lecture notes.
`;

  const parsedData = await callOpenRouter([
    {
      role: "system",
      content:
        "You are an expert academic study planner. Use only the supplied lecture notes and return valid JSON only."
    },
    {
      role: "user",
      content: prompt
    }
  ]);

  return {
    mainTopics: Array.isArray(parsedData.mainTopics)
      ? parsedData.mainTopics.map(String).filter(Boolean)
      : [],
    dashboardSuggestion:
      typeof parsedData.dashboardSuggestion === "string"
        ? parsedData.dashboardSuggestion.trim()
        : "Start with the next incomplete study day and focus on one task at a time.",
    generatedPlan: validateGeneratedPlan(
      parsedData.generatedPlan,
      days,
      studyTime
    )
  };
}

// Get every plan belonging to the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const plans = await Plan.find({
      userId: req.user.id
    }).sort({
      createdAt: -1
    });

    res.json(plans);
  } catch (error) {
    console.log("Load plans error:", error.message);

    res.status(500).json({
      message: "Could not load plans"
    });
  }
});

// Create a plan from pasted notes or an uploaded PDF
router.post(
  "/",
  authMiddleware,
  upload.single("lectureFile"),
  async (req, res) => {
    try {
      const title = req.body.title;
      const fileName = req.body.fileName || "";

      const requestedDays = Number(req.body.days);
      const studyTime = Number(req.body.studyTime);
      const breakTime = Number(req.body.breakTime);

      let lectureText = (req.body.notes || "").trim();

      if (req.file) {
        if (req.file.mimetype !== "application/pdf") {
          return res.status(400).json({
            message: "Only PDF files are currently supported"
          });
        }

        const extractedText = await extractPdfText(
          req.file.buffer
        );

        if (extractedText) {
          lectureText = lectureText
            ? lectureText + "\n\n" + extractedText
            : extractedText;
        }
      }

      if (!lectureText) {
        return res.status(400).json({
          message:
            "No readable text was found. The PDF may be scanned or image-based."
        });
      }

      if (
        !Number.isInteger(requestedDays) ||
        requestedDays < 1 ||
        requestedDays > 14
      ) {
        return res.status(400).json({
          message: "Study days must be between 1 and 14"
        });
      }

      if (
        !Number.isFinite(studyTime) ||
        studyTime < 1
      ) {
        return res.status(400).json({
          message: "Study time is required"
        });
      }

      if (
        !Number.isFinite(breakTime) ||
        breakTime < 1
      ) {
        return res.status(400).json({
          message: "Break time is required"
        });
      }

      const wordCount = lectureText
        .split(/\s+/)
        .filter(Boolean)
        .length;

      const estimatedStudyMinutes = Math.ceil(
        wordCount / 50
      );

      const recommendedDays = Math.max(
        1,
        Math.min(14, Math.ceil(estimatedStudyMinutes / studyTime))
      );

      const days = Math.max(requestedDays, recommendedDays);

      const aiPlan = await generateStudyPlan({
        lectureText,
        days,
        studyTime,
        breakTime
      });

      const plan = await Plan.create({
        userId: req.user.id,

        title:
          title ||
          fileName ||
          "Pasted Lecture Notes",

        fileName,
        notes: lectureText,

        days,
        studyTime,
        breakTime,

        wordCount,
        estimatedStudyMinutes,

        requestedDays,
        recommendedDays,
        mainTopics: aiPlan.mainTopics,
        revisionDayAdded: aiPlan.generatedPlan.some(day => day.isRevisionDay),
        dashboardSuggestion: aiPlan.dashboardSuggestion,

        generatedPlan: aiPlan.generatedPlan,
        completedDays: []
      });

      res.status(201).json(plan);
    } catch (error) {
      console.log(
        "Create plan error:",
        error.response?.data || error.message
      );

      res.status(500).json({
        message:
          "Could not extract the lecture or generate the study plan"
      });
    }
  }
);

// Generate and cache a lesson for one topic from this plan
router.post("/:id/topic-explanation", authMiddleware, async (req, res) => {
  try {
    const topic = String(req.body.topic || "").trim();

    const plan = await Plan.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const allowedTopics = plan.generatedPlan.flatMap(day => day.topics || []);
    const matchedTopic = allowedTopics.find(
      item => item.toLowerCase() === topic.toLowerCase()
    );

    if (!matchedTopic) {
      return res.status(400).json({
        message: "This topic does not belong to the selected lecture"
      });
    }

    const cachedLesson = plan.topicLessons.find(
      lesson => lesson.topic.toLowerCase() === matchedTopic.toLowerCase()
    );

    if (cachedLesson) {
      return res.json(cachedLesson);
    }

    const lesson = await callOpenRouter([
      {
        role: "system",
        content:
          "You are a grounded study tutor. Use only the supplied lecture text. If the notes do not support a claim, do not include it. Return valid JSON only."
      },
      {
        role: "user",
        content: `
Teach this lecture topic in simple student-friendly language.

TOPIC: ${matchedTopic}

LECTURE TEXT:
${plan.notes.slice(0, 60000)}

Return exactly this JSON structure:
{
  "easyExplanation": "A clear simple explanation",
  "sections": [
    { "heading": "Small section title", "content": "Short explanation" }
  ],
  "examples": ["Example grounded in the lecture"],
  "keyPoints": ["Important point"],
  "quiz": [
    {
      "question": "Question",
      "options": ["A", "B", "C", "D"],
      "answer": "Correct option text"
    }
  ]
}

Create 2-4 sections, useful examples when supported, 4-6 key points, and exactly 5 quiz questions.
Do not add unrelated general knowledge.
`
      }
    ]);

    const normalizedLesson = {
      topic: matchedTopic,
      easyExplanation: String(lesson.easyExplanation || "").trim(),
      sections: Array.isArray(lesson.sections)
        ? lesson.sections.map(section => ({
            heading: String(section.heading || "").trim(),
            content: String(section.content || "").trim()
          })).filter(section => section.heading && section.content)
        : [],
      examples: Array.isArray(lesson.examples)
        ? lesson.examples.map(String).filter(Boolean)
        : [],
      keyPoints: Array.isArray(lesson.keyPoints)
        ? lesson.keyPoints.map(String).filter(Boolean)
        : [],
      quiz: Array.isArray(lesson.quiz)
        ? lesson.quiz.slice(0, 5).map(question => ({
            question: String(question.question || "").trim(),
            options: Array.isArray(question.options)
              ? question.options.map(String).slice(0, 4)
              : [],
            answer: String(question.answer || "").trim()
          })).filter(question => question.question)
        : [],
      generatedAt: new Date()
    };

    if (!normalizedLesson.easyExplanation || normalizedLesson.keyPoints.length === 0) {
      throw new Error("AI returned an incomplete topic lesson");
    }

    plan.topicLessons.push(normalizedLesson);
    await plan.save();

    res.json(normalizedLesson);
  } catch (error) {
    console.log("Topic explanation error:", error.response?.data || error.message);
    res.status(500).json({ message: "Could not generate this topic lesson" });
  }
});

// Generate and cache YouTube recommendations for study days missing them
router.post("/:id/video-recommendations", authMiddleware, async (req, res) => {
  try {
    const plan = await Plan.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const generationErrors = [];

    for (const studyDay of plan.generatedPlan) {
      if (
        Array.isArray(studyDay.videoRecommendations) &&
        studyDay.videoRecommendations.length > 0
      ) {
        continue;
      }

      try {
        const recommendations = await generateVideoRecommendationsForDay(
          plan,
          studyDay
        );

        if (recommendations.length > 0) {
          studyDay.videoRecommendations = recommendations;
          studyDay.videoRecommendationsGeneratedAt = new Date();
        }
      } catch (error) {
        generationErrors.push({
          day: studyDay.day,
          message: error.message
        });
        console.log(
          "Video recommendation error:",
          studyDay.day,
          error.response?.data || error.message
        );
      }
    }

    plan.markModified("generatedPlan");
    await plan.save();

    res.json({
      generatedPlan: plan.generatedPlan,
      partialFailure: generationErrors.length > 0,
      errors: generationErrors
    });
  } catch (error) {
    console.log("Video recommendations route error:", error.response?.data || error.message);
    res.status(500).json({
      message: "Could not generate video recommendations"
    });
  }
});

// Generate revision material and complete one study day
router.post("/:id/complete-session", authMiddleware, async (req, res) => {
  try {
    const dayNumber = Number(req.body.day);

    const plan = await Plan.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > plan.days) {
      return res.status(400).json({ message: "Invalid study day" });
    }

    const studyDay = plan.generatedPlan.find(day => day.day === dayNumber);

    if (!studyDay) {
      return res.status(404).json({ message: "Study day not found" });
    }

    if (studyDay.revisionSummary && studyDay.completionQuiz.length > 0) {
      return res.json({
        revisionSummary: studyDay.revisionSummary,
        quiz: studyDay.completionQuiz,
        completedDays: plan.completedDays,
        dashboardSuggestion: plan.dashboardSuggestion
      });
    }

    const result = await callOpenRouter([
      {
        role: "system",
        content:
          "You are a grounded revision tutor. Use only the supplied lecture and study-day content. Return valid JSON only."
      },
      {
        role: "user",
        content: `
Create a quick end-of-session revision for Day ${dayNumber}.

DAY TITLE: ${studyDay.title}
TOPICS: ${studyDay.topics.join(", ")}
EXPLANATION: ${studyDay.explanation}
KEY POINTS: ${studyDay.keyPoints.join(" | ")}

LECTURE TEXT:
${plan.notes.slice(0, 50000)}

Return exactly this JSON:
{
  "revisionSummary": "A concise revision summary",
  "quiz": [
    {
      "question": "Quick question",
      "options": ["A", "B", "C", "D"],
      "answer": "Correct option text"
    }
  ],
  "motivationTip": "One short suggestion based on the student's progress"
}

Generate 3-5 quiz questions. Use only the supplied material.
`
      }
    ]);

    const completionQuiz = Array.isArray(result.quiz)
      ? result.quiz.slice(0, 5).map(question => ({
          question: String(question.question || "").trim(),
          options: Array.isArray(question.options)
            ? question.options.map(String).slice(0, 4)
            : [],
          answer: String(question.answer || "").trim()
        })).filter(question => question.question)
      : [];

    if (!result.revisionSummary || completionQuiz.length < 3) {
      throw new Error("AI returned incomplete revision material");
    }

    studyDay.revisionSummary = String(result.revisionSummary).trim();
    studyDay.completionQuiz = completionQuiz;
    studyDay.completedAt = new Date();

    if (!plan.completedDays.includes(dayNumber)) {
      plan.completedDays.push(dayNumber);
    }

    if (typeof result.motivationTip === "string" && result.motivationTip.trim()) {
      plan.dashboardSuggestion = result.motivationTip.trim();
    }

    plan.markModified("generatedPlan");
    await plan.save();

    res.json({
      revisionSummary: studyDay.revisionSummary,
      quiz: studyDay.completionQuiz,
      completedDays: plan.completedDays,
      dashboardSuggestion: plan.dashboardSuggestion
    });
  } catch (error) {
    console.log("Complete session error:", error.response?.data || error.message);
    res.status(500).json({ message: "Could not complete this study session" });
  }
});

// Get one plan belonging to the logged-in user
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const plan = await Plan.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found"
      });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({
      message: "Could not load plan"
    });
  }
});

// Mark one study day complete
router.patch(
  "/:id/complete-day",
  authMiddleware,
  async (req, res) => {
    try {
      const day = Number(req.body.day);

      const plan = await Plan.findOne({
        _id: req.params.id,
        userId: req.user.id
      });

      if (!plan) {
        return res.status(404).json({
          message: "Plan not found"
        });
      }

      if (
        !Number.isInteger(day) ||
        day < 1 ||
        day > plan.days
      ) {
        return res.status(400).json({
          message: "Invalid study day"
        });
      }

      if (!plan.completedDays.includes(day)) {
        plan.completedDays.push(day);
      }

      await plan.save();

      res.json(plan);
    } catch (error) {
      console.log(
        "Complete day error:",
        error.message
      );

      res.status(500).json({
        message: "Could not update plan"
      });
    }
  }
);

// Delete one plan belonging to the logged-in user
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deletedPlan = await Plan.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!deletedPlan) {
      return res.status(404).json({
        message: "Plan not found"
      });
    }

    res.json({
      message: "Plan deleted"
    });
  } catch (error) {
    console.log(
      "Delete plan error:",
      error.message
    );

    res.status(500).json({
      message: "Could not delete plan"
    });
  }
});

module.exports = router;
