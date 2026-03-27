import React, { useState, useEffect } from "react";
import { getMyTeam } from './api';
import Login from "./components/Login";
import Onboarding from './components/Onboarding';
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [hasTeam, setHasTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle auth redirect from Lambda
    const authData = params.get("auth");
    const authError = params.get("auth_error");

    if (authData) {
      try {
        const decoded = JSON.parse(atob(decodeURIComponent(authData)));
        if (decoded.user) {
          setUser(decoded.user);
          localStorage.setItem("reviewflow_user", JSON.stringify(decoded.user));
          if (decoded.session_token) {
            localStorage.setItem('session_token', decoded.session_token);
          }
          if (decoded.github_token) {
            localStorage.setItem("github_token", decoded.github_token);
          }
          // Check if user has a team
          setHasTeam(!!decoded.user.team_id);
        }
      } catch (err) {
          console.error("Failed to parse auth data:", err);
      }
      // Clean up the URL
      window.history.replaceState({}, document.title, "/");
      setLoading(false);
    } else if (authError) {
        console.error("Auth error:", authError);
        window.history.replaceState({}, document.title, "/");
        setLoading(false);
    } else {
      // Check for existing session
      const savedUser = localStorage.getItem("reviewflow_user");
      const sessionToken = localStorage.getItem('session_token');
      if (savedUser && sessionToken) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          getMyTeam()
            .then((res) => {
              const team = res.data?.data?.team;
              setHasTeam(!!team);
              if (team) {
                // Update user with latest team_id
                parsed.team_id = team.team_id;
                setUser({ ...parsed });
                localStorage.setItem('reviewflow_user', JSON.stringify(parsed));
              }
            })
            .catch(() => {
              setHasTeam(!!parsed.team_id);
            })
            .finally(() => setLoading(false));
        } catch (e) {
          localStorage.removeItem("reviewflow_user");
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    setHasTeam(null);
    localStorage.removeItem("reviewflow_user");
    localStorage.removeItem('session_token');
    localStorage.removeItem("github_token");
  };

  const handleOnboardingComplete = (teamId) => {
    if (teamId) {
      const updatedUser = { ...user, team_id: teamId };
      setUser(updatedUser);
      localStorage.setItem('reviewflow_user', JSON.stringify(updatedUser));
    }
    setHasTeam(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-rf-bg-primary flex items-center justify-center">
        <div className="text-rf-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!hasTeam) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
