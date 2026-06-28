import http from "k6/http";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend, Rate } from "k6/metrics";

const apiBase = (__ENV.API_BASE || "").replace(/\/+$/, "");
const assessmentId = __ENV.ASSESSMENT_ID || "";
const usersCsvPath = __ENV.USERS_CSV || "students.csv";
const autosaveRounds = Number(__ENV.AUTOSAVE_ROUNDS || 3);
const autosavePauseSec = Number(__ENV.AUTOSAVE_PAUSE_SEC || 15);
const submitAtEnd = (__ENV.SUBMIT || "true").toLowerCase() !== "false";
const thinkMinSec = Number(__ENV.THINK_MIN_SEC || 1);
const thinkMaxSec = Number(__ENV.THINK_MAX_SEC || 4);

export const slowRequests = new Rate("slow_requests_over_2s");
export const verySlowRequests = new Rate("slow_requests_over_5s");
export const loginDuration = new Trend("login_duration");
export const startAttemptDuration = new Trend("start_attempt_duration");
export const saveAnswersDuration = new Trend("save_answers_duration");
export const submitAttemptDuration = new Trend("submit_attempt_duration");

const students = new SharedArray("student users", () => {
  const raw = open(usersCsvPath).trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((h) => h.trim().toLowerCase());
  const emailIndex = header.indexOf("email");
  const passwordIndex = header.indexOf("password");
  if (emailIndex < 0 || passwordIndex < 0) {
    throw new Error("USERS_CSV must have email,password columns");
  }
  return lines.map((line) => {
    const cols = line.split(",").map((v) => v.trim());
    return { email: cols[emailIndex], password: cols[passwordIndex] };
  });
});

export const options = {
  scenarios: {
    simultaneous_students: {
      executor: "per-vu-iterations",
      vus: Number(__ENV.VUS || 50),
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || "10m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    slow_requests_over_2s: ["rate<0.10"],
    slow_requests_over_5s: ["rate<0.02"],
    login_duration: ["p(95)<2000"],
    start_attempt_duration: ["p(95)<2500"],
    save_answers_duration: ["p(95)<2500"],
    submit_attempt_duration: ["p(95)<5000"],
  },
};

function jsonHeaders(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

function recordLatency(res, trend) {
  trend.add(res.timings.duration);
  slowRequests.add(res.timings.duration >= 2000);
  verySlowRequests.add(res.timings.duration >= 5000);
}

function randomSleep() {
  const span = Math.max(thinkMaxSec - thinkMinSec, 0);
  sleep(thinkMinSec + Math.random() * span);
}

function pickAnswer(questionWrapper, vuSeed) {
  const question = questionWrapper.question || questionWrapper;
  const options = question.options || [];
  if (options.length > 0) {
    const option = options[(vuSeed + question.id.length) % options.length];
    return { questionId: question.id, selectedOptionId: option.id };
  }
  return { questionId: question.id, textAnswer: `Respuesta de carga VU ${__VU}` };
}

function chunk(items, count) {
  const size = Math.max(1, Math.ceil(items.length / count));
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export default function () {
  if (!apiBase) fail("API_BASE is required, e.g. https://preview.example.com/api/v1");
  if (!assessmentId) fail("ASSESSMENT_ID is required");
  if (students.length === 0) fail("USERS_CSV has no users");

  const student = students[(__VU - 1) % students.length];

  const loginRes = http.post(
    `${apiBase}/auth/login`,
    JSON.stringify({ email: student.email, password: student.password }),
    { headers: { "Content-Type": "application/json" } },
  );
  recordLatency(loginRes, loginDuration);
  check(loginRes, { "login 200": (r) => r.status === 200 });
  if (loginRes.status !== 200) fail(`Login failed for ${student.email}: ${loginRes.status} ${loginRes.body}`);

  const token = loginRes.json("token");
  if (!token) fail(`Login response did not include token for ${student.email}`);

  randomSleep();

  const assessmentRes = http.get(`${apiBase}/assessments/${assessmentId}`, jsonHeaders(token));
  check(assessmentRes, { "assessment loaded": (r) => r.status === 200 });
  if (assessmentRes.status !== 200) fail(`Assessment load failed: ${assessmentRes.status} ${assessmentRes.body}`);

  const questions = assessmentRes.json("questions") || [];
  if (!questions.length) fail("Assessment has no questions");

  const startRes = http.post(`${apiBase}/attempts/start/${assessmentId}`, JSON.stringify({}), jsonHeaders(token));
  recordLatency(startRes, startAttemptDuration);
  check(startRes, { "attempt started": (r) => r.status === 201 || r.status === 200 });
  if (startRes.status !== 201 && startRes.status !== 200) {
    fail(`Start attempt failed for ${student.email}: ${startRes.status} ${startRes.body}`);
  }

  const attemptId = startRes.json("attemptId");
  if (!attemptId) fail("Start attempt response did not include attemptId");

  randomSleep();

  const answers = questions.map((q) => pickAnswer(q, __VU));
  const answerChunks = chunk(answers, Math.max(autosaveRounds, 1));
  let elapsed = 0;

  for (const part of answerChunks) {
    elapsed += autosavePauseSec;
    const saveRes = http.post(
      `${apiBase}/attempts/${attemptId}/answers`,
      JSON.stringify({ answers: part, timeSpentSec: elapsed }),
      jsonHeaders(token),
    );
    recordLatency(saveRes, saveAnswersDuration);
    check(saveRes, { "answers saved": (r) => r.status === 201 || r.status === 200 });
    if (saveRes.status !== 201 && saveRes.status !== 200) {
      fail(`Save answers failed for ${student.email}: ${saveRes.status} ${saveRes.body}`);
    }
    sleep(autosavePauseSec);
  }

  if (submitAtEnd) {
    const submitRes = http.post(
      `${apiBase}/attempts/${attemptId}/submit`,
      JSON.stringify({ timeSpentSec: elapsed, confirmEmpty: true }),
      jsonHeaders(token),
    );
    recordLatency(submitRes, submitAttemptDuration);
    check(submitRes, { "attempt submitted": (r) => r.status === 200 });
    if (submitRes.status !== 200) {
      fail(`Submit failed for ${student.email}: ${submitRes.status} ${submitRes.body}`);
    }
  }
}