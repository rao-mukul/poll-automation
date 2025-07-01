import { motion } from "framer-motion";
import WelcomeSection from "./WelcomeSection";
import QuickAccessCards from "./QuickAccessCards";
import GlassCard from "../GlassCard";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

const DashboardHomePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/users/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setDashboardData);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex justify-end mb-4">
        <button
          onClick={() => navigate("/host")}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-medium transition"
        >
          Switch to Host
        </button>
      </div>
      <WelcomeSection />
      <QuickAccessCards onSectionChange={() => { /* handle section change here */ }} />
      {/* Recent Activity */}
      <GlassCard className="p-6">
        <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { action: "Completed Math Quiz", time: "2 minutes ago", points: "+50 points" },
            { action: "Joined History Poll", time: "15 minutes ago", points: "+25 points" },
            { action: 'Achieved "Speed Demon" badge', time: "1 hour ago", points: "+100 points" },
            { action: "Ranked up to #7", time: "2 hours ago", points: "Rank change" },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium">{activity.action}</p>
                <p className="text-sm text-gray-400">{activity.time}</p>
              </div>
              <div className="text-sm text-green-400">{activity.points}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default DashboardHomePage;
const setDashboardData = (data: unknown) => {
  // You can update state here when dashboard data is fetched.
  // For now, just log the data for debugging.
  console.log("Dashboard data:", data);
};

