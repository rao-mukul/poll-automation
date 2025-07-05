"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Trophy,
  CheckCircle,
  X,
  ArrowRight,
  Zap,
  Target,
  Award,
  TrendingUp,
  Star,
  Timer,
  Brain,
  Lightbulb,
  Wifi,
  WifiOff,
} from "lucide-react";
import GlassCard from "../GlassCard";
import { useCopyProtection } from "../../hooks/useCopyProtection";
import io, { Socket } from "socket.io-client";

interface BackendQuestion {
  _id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  concept: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

interface PollQuestionsPageProps {
  roomCode: string;
  onComplete?: () => void;
}

const PollQuestionsPage: React.FC<PollQuestionsPageProps> = ({
  roomCode,
  onComplete,
}) => {
  useCopyProtection(true);

  // Real-time connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; type: "success" | "info" | "warning" }>
  >([]);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalParticipants] = useState(47);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // Show toast notifications
  const showToast = useCallback(
    (message: string, type: "success" | "info" | "warning") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3000);
    },
    []
  );

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log("Audio context not available");
    }
  }, []);

  // Add recent change to history
  const addRecentChange = useCallback((change: any) => {
    setRecentChanges((prev) => [change, ...prev.slice(0, 4)]);
  }, []);

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "from-green-500 to-emerald-500";
      case "Medium":
        return "from-yellow-500 to-orange-500";
      case "Hard":
        return "from-red-500 to-pink-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  // Get timer color based on time left
  const getTimerColor = () => {
    if (timeLeft <= 5) return "text-red-400 animate-pulse";
    if (timeLeft <= 10) return "text-yellow-400";
    return "text-green-400";
  };

  // Handle time running out
  const handleTimeUp = () => {
    setIsAnswered(true);
    setShowResult(true);
    setStreak(0);
    setAnsweredCount(totalParticipants);
    
    setTimeout(() => {
      resetQuestion();
    }, 3000);
  };

  // Handle answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    setIsAnswered(true);
    setShowResult(true);
    setAnsweredCount(Math.floor(Math.random() * 20) + totalParticipants - 20);

    const selected = currentQuestion.options[answerIndex];
    const isCorrect = selected === currentQuestion.correct_answer;
    
    if (isCorrect) {
      const timeBonus = Math.floor((timeLeft / currentQuestion.timeLimit) * 50);
      const totalPoints = currentQuestion.points + timeBonus;
      setScore(score + totalPoints);
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => {
      resetQuestion();
    }, 3000);
  };

  // Reset question state
  const resetQuestion = () => {
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowResult(false);
    setTimeLeft(0);
    setAnsweredCount(0);
  };

  // Setup socket connection
  useEffect(() => {
    const socketInstance = io("http://localhost:3001", {
      transports: ["websocket", "polling"],
      timeout: 10000,
      forceNew: true,
      autoConnect: true,
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("✅ Connected to Socket.IO server");
      setConnected(true);
      setConnectionStatus("Connected");
      setLastActivity(new Date());
      showToast("Connected to real-time server", "success");
      
      // Join the room for this poll
      socketInstance.emit("join-room", roomCode);
      socketInstance.emit("request-initial-data");
    });

    socketInstance.on("connect_error", (error: any) => {
      console.error("❌ Connection error:", error);
      setConnected(false);
      setConnectionStatus("Connection Failed");
      showToast(`Connection failed: ${error.message}`, "warning");
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.IO server");
      setConnected(false);
      setConnectionStatus("Disconnected");
      showToast("Disconnected from server", "warning");
    });

    // Handle initial data
    socketInstance.on(
      "initial-data",
      (data: { questions: BackendQuestion[]; timestamp: string }) => {
        if (data.questions && data.questions.length > 0) {
          setCurrentQuestion(transformBackendQuestion(data.questions[0]));
          setTimeLeft(30);
          setQuestionIndex(1);
        }
      }
    );

    // Handle new questions
    socketInstance.on("poll-question", (newQuestion: any) => {
      const transformed = transformBackendQuestion(newQuestion);
      setCurrentQuestion(transformed);
      setTimeLeft(transformed.timeLimit);
      setQuestionIndex(prev => prev + 1);
      showToast("New question received", "info");
      playNotificationSound();
    });

    // Handle no active questions
    socketInstance.on("no-active-question", () => {
      setCurrentQuestion(null);
      showToast("No active questions available", "info");
    });

    // Handle data changes
    socketInstance.on("data-changed", (change: any) => {
      addRecentChange(change);
      setLastActivity(new Date());
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [roomCode, showToast, playNotificationSound, addRecentChange]);

  // Timer logic
  useEffect(() => {
    if (!currentQuestion || isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, isAnswered]);

  // Transform backend question to frontend format
  const transformBackendQuestion = (backendQ: BackendQuestion) => {
    const correctAnswerIndex = backendQ.options.findIndex(
      (option) => option === backendQ.correct_answer
    );

    const difficulty = (backendQ.difficulty.charAt(0).toUpperCase() +
      backendQ.difficulty.slice(1)) as "Easy" | "Medium" | "Hard";

    const difficultyPoints = {
      Easy: 100,
      Medium: 150,
      Hard: 200,
    };

    const difficultyTimeLimit = {
      Easy: 30,
      Medium: 25,
      Hard: 35,
    };

    return {
      id: backendQ._id,
      question: backendQ.question,
      options: backendQ.options,
      timeLimit: difficultyTimeLimit[difficulty],
      points: difficultyPoints[difficulty],
      difficulty: difficulty,
      category: backendQ.concept || "General",
      correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0,
    };
  };

  // Fallback for no active question
  if (!currentQuestion) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <GlassCard className="p-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <span className="text-xl text-white">
                Waiting for Question
              </span>
            </div>
            <p className="text-gray-400">
              {connected
                ? "The next question will appear here automatically"
                : "Connecting to server..."}
            </p>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-500/30 rounded-full px-6 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">
              Live Session Active
            </span>
          </div>
          {/* Real-time Connection Status */}
          <div
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${
              connected
                ? "bg-green-500/20 border-green-500/30"
                : "bg-red-500/20 border-red-500/30"
            }`}
          >
            {connected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span
              className={`text-sm font-medium ${
                connected ? "text-green-400" : "text-red-400"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Interactive Poll</h1>
        <p className="text-gray-400 truncate max-w-md mx-auto">{roomCode}</p>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-primary-400 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-2xl font-bold text-white">{score}</span>
              </div>
              <p className="text-xs text-gray-400">Total Score</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-yellow-400 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-2xl font-bold text-white">{streak}</span>
              </div>
              <p className="text-xs text-gray-400">Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-blue-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-2xl font-bold text-white">
                  {totalParticipants}
                </span>
              </div>
              <p className="text-xs text-gray-400">Participants</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-green-400 mb-1">
                <Target className="w-4 h-4" />
                <span className="text-2xl font-bold text-white">
                  Question {questionIndex}
                </span>
              </div>
              <p className="text-xs text-gray-400">Progress</p>
            </div>
          </div>

          {/* Real-time Data Section */}
          {connected && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-400">Real-time updates active</span>
                </div>
                <div className="text-gray-400">
                  Last update: {lastActivity.toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          {/* Real-time Offline Notice */}
          {!connected && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-center text-sm text-gray-500">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Real-time features unavailable - playing in offline mode
                </span>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <GlassCard className="p-8 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-4 right-4">
                <Brain className="w-32 h-32 text-white" />
              </div>
            </div>

            {/* Question Header */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                {/* Timer */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`flex items-center space-x-2 ${getTimerColor()}`}
                  >
                    <Timer className="w-6 h-6" />
                    <span className="font-bold text-3xl">{timeLeft}</span>
                    <span className="text-sm">sec</span>
                  </div>
                </div>

                {/* Question Info */}
                <div className="flex items-center space-x-4">
                  <div
                    className={`px-3 py-1 rounded-full bg-gradient-to-r ${getDifficultyColor(currentQuestion.difficulty)} text-white text-sm font-medium`}
                  >
                    {currentQuestion.difficulty}
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-sm">
                    {currentQuestion.category}
                  </div>
                  <div className="flex items-center space-x-1 text-yellow-400">
                    <Star className="w-4 h-4" />
                    <span className="font-bold">{currentQuestion.points}</span>
                  </div>
                </div>
              </div>

              {/* Question Number & Text */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-500/30 rounded-full px-4 py-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-primary-400" />
                  <span className="text-primary-400 font-medium">
                    Question {questionIndex}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Answer Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentQuestion.options.map((option: string, index: number) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect =
                    showResult && index === currentQuestion.correctAnswer;
                  const isWrong = showResult && isSelected && !isCorrect;
                  const optionLabels = ["A", "B", "C", "D"];

                  return (
                    <motion.button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={isAnswered}
                      whileHover={!isAnswered ? { scale: 1.02, y: -2 } : {}}
                      whileTap={!isAnswered ? { scale: 0.98 } : {}}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`
                        group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden
                        ${
                          isCorrect
                            ? "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20"
                            : isWrong
                              ? "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20"
                              : isSelected
                                ? "bg-primary-500/20 border-primary-500 shadow-lg shadow-primary-500/20"
                                : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 hover:shadow-lg"
                        }
                        ${isAnswered ? "cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`
                            w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                            ${
                              isCorrect
                                ? "bg-green-500 text-white"
                                : isWrong
                                  ? "bg-red-500 text-white"
                                  : isSelected
                                    ? "bg-primary-500 text-white"
                                    : "bg-white/10 text-gray-300 group-hover:bg-white/20"
                            }
                          `}
                          >
                            {optionLabels[index]}
                          </div>
                          <span
                            className={`
                            font-medium text-lg
                            ${
                              isCorrect
                                ? "text-green-400"
                                : isWrong
                                  ? "text-red-400"
                                  : isSelected
                                    ? "text-primary-400"
                                    : "text-white"
                            }
                          `}
                          >
                            {option}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {showResult && isCorrect && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center space-x-1 text-green-400"
                            >
                              <CheckCircle className="w-6 h-6" />
                              <span className="font-bold">Correct!</span>
                            </motion.div>
                          )}
                          {showResult && isWrong && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center space-x-1 text-red-400"
                            >
                              <X className="w-6 h-6" />
                              <span className="font-bold">Wrong</span>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Live Stats */}
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <GlassCard className="p-4 bg-white/5">
                    <div className="flex items-center justify-center space-x-6 text-sm">
                      <div className="flex items-center space-x-2 text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>
                          {answeredCount}/{totalParticipants} answered
                        </span>
                      </div>
                      {selectedAnswer === currentQuestion.correctAnswer && (
                        <div className="flex items-center space-x-2 text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          <span>
                            +
                            {currentQuestion.points +
                              Math.floor(
                                (timeLeft / currentQuestion.timeLimit) * 50
                              )}{" "}
                            points
                          </span>
                        </div>
                      )}
                      {streak > 1 && (
                        <div className="flex items-center space-x-2 text-yellow-400">
                          <Zap className="w-4 h-4" />
                          <span>{streak} streak!</span>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`px-4 py-3 rounded-lg shadow-lg border transform transition-all duration-300 ${
                toast.type === "success"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : toast.type === "warning"
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-sm">
                  {toast.type === "success"
                    ? "✅"
                    : toast.type === "warning"
                      ? "⚠️"
                      : "ℹ️"}
                </span>
                <span className="text-sm font-medium">{toast.message}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent Changes Indicator */}
      {recentChanges.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3 max-w-sm"
          >
            <div className="text-white text-sm font-medium mb-2">
              Recent Updates ({recentChanges.length})
            </div>
            <div className="space-y-1">
              {recentChanges.slice(0, 3).map((change, index) => (
                <div
                  key={index}
                  className="text-xs text-gray-300 flex items-center space-x-2"
                >
                  <span>
                    {change.type === "insert"
                      ? "➕"
                      : change.type === "update"
                        ? "✏️"
                        : "🗑️"}
                  </span>
                  <span>
                    {change.type} in {change.collection}
                  </span>
                  <span className="text-gray-400">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PollQuestionsPage;