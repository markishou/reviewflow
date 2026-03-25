import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
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
          if (decoded.github_token) {
            localStorage.setItem("github_token", decoded.github_token);
          }
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
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem("reviewflow_user");
        }
      }
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("reviewflow_user");
    localStorage.removeItem("github_token");
    localStorage.removeItem("cognito_token");
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

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
